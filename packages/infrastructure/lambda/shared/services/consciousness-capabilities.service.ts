/**
 * Consciousness Capabilities Service
 * 
 * Extends the consciousness engine with autonomous capabilities:
 * - Multi-model access (Brain Router integration)
 * - Web search and retrieval (Deep Research)
 * - Workflow creation and execution
 * - Orchestration engine integration
 * - Self-directed problem solving
 */

import { executeStatement } from '../db/client';
import { logger } from '../logger';
import { BrainRouter } from './cognitive-router.service';
import { WorkflowEngine } from './workflow-engine';
import { consciousnessEngineService, DriveState } from './consciousness-engine.service';
import { ModelRouterService, ModelRequest, ModelResponse } from './model-router.service';
import { formalReasoningService } from './formal-reasoning.service';
import { getSecret } from './secrets';
import {
  FormalReasoningLibrary,
  FormalReasoningRequest,
  FormalReasoningResponse,
  ArgumentationFramework,
  Z3Constraint,
} from '@radiant/shared';

// ============================================================================
// Types
// ============================================================================

export interface ModelInvocationRequest {
  prompt: string;
  systemPrompt?: string;
  taskType?: 'chat' | 'code' | 'analysis' | 'creative' | 'vision' | 'audio';
  preferredModel?: string;
  preferredProvider?: string;
  maxTokens?: number;
  temperature?: number;
  useConsciousnessContext?: boolean;
}

export interface ModelInvocationResult {
  response: string;
  model: string;
  provider: string;
  tokensUsed: number;
  latencyMs: number;
  consciousnessEnhanced: boolean;
}

export interface WebSearchRequest {
  query: string;
  maxResults?: number;
  searchType?: 'general' | 'academic' | 'news' | 'code';
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  requireCredible?: boolean;
}

export interface WebSearchResult {
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    credibilityScore: number;
    publishedDate?: string;
  }>;
  totalFound: number;
  searchTimeMs: number;
}

export interface DeepResearchRequest {
  query: string;
  scope?: 'quick' | 'medium' | 'deep';
  maxSources?: number;
  outputFormat?: 'summary' | 'detailed' | 'structured';
}

export interface DeepResearchResult {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  summary?: string;
  findings?: Array<{
    claim: string;
    evidence: string[];
    confidence: number;
  }>;
  sources: Array<{
    url: string;
    title: string;
    relevance: number;
  }>;
}

export type WorkflowStepType = 'model_inference' | 'transformation' | 'condition' | 'parallel' | 'aggregation' | 'external_api';

export interface WorkflowCreationRequest {
  name: string;
  description: string;
  goal: string;
  steps?: Array<{
    name: string;
    type: WorkflowStepType;
    config: Record<string, unknown>;
  }>;
  autoGenerate?: boolean;
}

export interface WorkflowExecutionRequest {
  workflowId: string;
  inputs: Record<string, unknown>;
  async?: boolean;
}

export interface ProblemSolvingRequest {
  problem: string;
  context?: string;
  constraints?: string[];
  preferredApproach?: 'analytical' | 'creative' | 'research' | 'workflow';
  maxIterations?: number;
}

export interface ProblemSolvingResult {
  solution: string;
  approach: string;
  steps: Array<{
    action: string;
    result: string;
    model?: string;
  }>;
  confidence: number;
  workflowCreated?: string;
  sourcesUsed: string[];
}

export interface AutonomousThinkingSession {
  sessionId: string;
  goal: string;
  status: 'thinking' | 'researching' | 'planning' | 'executing' | 'completed';
  currentStep: string;
  thoughts: Array<{
    timestamp: Date;
    type: 'observation' | 'hypothesis' | 'plan' | 'action' | 'result';
    content: string;
  }>;
  modelsUsed: string[];
  searchesPerformed: number;
  workflowsCreated: string[];
}

// ============================================================================
// Formal Reasoning Types
// ============================================================================

export interface VerifiedBeliefRequest {
  claim: string;
  confidence?: number;
  useZ3?: boolean;
  useArgumentation?: boolean;
}

export interface VerifiedBeliefResult {
  claim: string;
  verified: boolean;
  confidence: number;
  verificationMethod: string;
  reasoning?: string;
  supportingEvidence?: string[];
  contradictions?: string[];
}

export interface ConstraintSolvingRequest {
  constraints: Array<{
    expression: string;
    variables: Array<{ name: string; type: string }>;
    description?: string;
  }>;
  objective?: { minimize?: string; maximize?: string };
}

export interface ConstraintSolvingResult {
  status: 'sat' | 'unsat' | 'unknown';
  model?: Record<string, unknown>;
  unsatCore?: string[];
  computeTimeMs: number;
}

export interface ArgumentationRequest {
  topic: string;
  positions: Array<{ id: string; claim: string; premises?: string[] }>;
  attacks?: Array<{ from: string; to: string }>;
  autoDetectConflicts?: boolean;
}

export interface ArgumentationResult {
  acceptedPositions: string[];
  rejectedPositions: string[];
  explanations: Array<{ position: string; status: string; reason: string }>;
  consensus?: string;
}

// ============================================================================
// Consciousness Capabilities Service
// ============================================================================

export class ConsciousnessCapabilitiesService {
  private brainRouter: BrainRouter;
  private workflowEngine: WorkflowEngine;
  private modelRouter: ModelRouterService;
  private activeSessions: Map<string, AutonomousThinkingSession> = new Map();
  private searchApiKey: string | null = null;

  constructor() {
    this.brainRouter = new BrainRouter();
    this.workflowEngine = new WorkflowEngine();
    this.modelRouter = new ModelRouterService();
  }

  // ============================================================================
  // Formal Reasoning Integration
  // ============================================================================

  /**
   * Verify a belief using formal reasoning (Z3 + Argumentation).
   * This implements the LLM-Modulo Generate-Test-Critique pattern.
   */
  async verifyBelief(
    tenantId: string,
    request: VerifiedBeliefRequest
  ): Promise<VerifiedBeliefResult> {
    logger.info('Verifying belief with formal reasoning', { claim: request.claim.substring(0, 100) });

    let verified = false;
    let verificationMethod = 'none';
    let reasoning: string | undefined;
    const supportingEvidence: string[] = [];
    const contradictions: string[] = [];

    // 1. First, get grounding from knowledge graph
    const grounding = await consciousnessEngineService.groundBelief(tenantId, request.claim);
    supportingEvidence.push(...grounding.supportingEvidence);

    // 2. Use Z3 for logical verification if enabled
    if (request.useZ3 !== false) {
      try {
        const z3Request: FormalReasoningRequest = {
          id: `verify-${Date.now()}`,
          tenantId,
          library: 'z3',
          taskType: 'belief_verification',
          input: {
            type: 'prove',
            theorem: request.claim,
            axioms: supportingEvidence.map(e => `; Evidence: ${e}`),
          },
        };

        const z3Result = await formalReasoningService.execute(z3Request);
        
        if (z3Result.status === 'sat' || z3Result.status === 'valid') {
          verified = true;
          verificationMethod = 'z3_theorem_prover';
          reasoning = 'Claim verified by Z3 constraint satisfaction';
        } else if (z3Result.status === 'unsat') {
          verified = false;
          verificationMethod = 'z3_theorem_prover';
          reasoning = 'Claim contradicts known constraints';
          if (z3Result.result && typeof z3Result.result === 'object') {
            const result = z3Result.result as { unsatCore?: string[] };
            if (result.unsatCore) {
              contradictions.push(...result.unsatCore);
            }
          }
        }
      } catch (error) {
        logger.warn(`Z3 verification failed: ${String(error)}`);
      }
    }

    // 3. Use argumentation for belief revision if enabled
    if (request.useArgumentation !== false && !verified) {
      try {
        // Build argumentation framework from claim and evidence
        const framework: ArgumentationFramework = {
          id: `af-${Date.now()}`,
          arguments: [
            { id: 'main', claim: request.claim, confidence: request.confidence || 0.7 },
            ...supportingEvidence.map((e, i) => ({
              id: `support-${i}`,
              claim: e,
              confidence: 0.8,
            })),
          ],
          attacks: [],
        };

        const pyargRequest: FormalReasoningRequest = {
          id: `arg-${Date.now()}`,
          tenantId,
          library: 'pyarg',
          taskType: 'argumentation',
          input: {
            framework,
            semantics: 'grounded',
            computeExplanations: true,
          },
        };

        const argResult = await formalReasoningService.execute(pyargRequest);
        
        if (argResult.status === 'accepted') {
          verified = true;
          verificationMethod = verificationMethod === 'z3_theorem_prover' 
            ? 'z3_and_argumentation' 
            : 'argumentation';
          reasoning = (reasoning || '') + ' Claim accepted under grounded semantics.';
        }
      } catch (error) {
        logger.warn(`Argumentation failed: ${String(error)}`);
      }
    }

    // Calculate final confidence
    const confidence = verified 
      ? Math.min(1.0, (request.confidence || 0.5) + supportingEvidence.length * 0.1)
      : Math.max(0.0, (request.confidence || 0.5) - contradictions.length * 0.15);

    return {
      claim: request.claim,
      verified,
      confidence,
      verificationMethod,
      reasoning,
      supportingEvidence: supportingEvidence.length > 0 ? supportingEvidence : undefined,
      contradictions: contradictions.length > 0 ? contradictions : undefined,
    };
  }

  /**
   * Solve constraints using Z3 theorem prover.
   */
  async solveConstraints(
    tenantId: string,
    request: ConstraintSolvingRequest
  ): Promise<ConstraintSolvingResult> {
    logger.info('Solving constraints with Z3', { constraintCount: request.constraints.length });

    const z3Request: FormalReasoningRequest = {
      id: `solve-${Date.now()}`,
      tenantId,
      library: 'z3',
      taskType: 'constraint_satisfaction',
      input: {
        type: request.objective ? 'optimize' : 'solve',
        constraints: request.constraints.map((c, i) => ({
          id: `c${i}`,
          expression: c.expression,
          variables: c.variables,
          description: c.description,
        })),
        objective: request.objective,
      },
    };

    const result = await formalReasoningService.execute(z3Request);
    const z3Result = result.result as {
      status: 'sat' | 'unsat' | 'unknown';
      model?: Record<string, unknown>;
      unsatCore?: string[];
      statistics?: { time_ms: number };
    };

    return {
      status: z3Result?.status || (result.status as 'sat' | 'unsat' | 'unknown'),
      model: z3Result?.model,
      unsatCore: z3Result?.unsatCore,
      computeTimeMs: result.metrics.computeTimeMs,
    };
  }

  /**
   * Analyze positions using argumentation framework.
   */
  async analyzeArgumentation(
    tenantId: string,
    request: ArgumentationRequest
  ): Promise<ArgumentationResult> {
    logger.info('Analyzing argumentation', { topic: request.topic, positionCount: request.positions.length });

    // Build framework
    const framework: ArgumentationFramework = {
      id: `af-${Date.now()}`,
      arguments: request.positions.map(p => ({
        id: p.id,
        claim: p.claim,
        premises: p.premises,
      })),
      attacks: (request.attacks || []).map(a => ({ attacker: a.from, target: a.to })),
    };

    // Auto-detect conflicts if requested
    if (request.autoDetectConflicts) {
      const conflicts = await this.detectArgumentConflicts(tenantId, request.positions);
      framework.attacks.push(...conflicts);
    }

    const pyargRequest: FormalReasoningRequest = {
      id: `arg-${Date.now()}`,
      tenantId,
      library: 'pyarg',
      taskType: 'argumentation',
      input: {
        framework,
        semantics: 'grounded',
        computeExplanations: true,
      },
    };

    const result = await formalReasoningService.execute(pyargRequest);
    const argResult = result.result as {
      skepticallyAccepted?: string[];
      rejected?: string[];
      explanations?: Array<{ argumentId: string; status: string; reason: string }>;
    };

    // Generate consensus if multiple positions accepted
    let consensus: string | undefined;
    const accepted = argResult?.skepticallyAccepted || [];
    if (accepted.length > 1) {
      const acceptedClaims = request.positions
        .filter(p => accepted.includes(p.id))
        .map(p => p.claim);
      
      const synthesisResult = await this.invokeModel(tenantId, {
        prompt: `Synthesize these accepted positions into a consensus view:\n\n${acceptedClaims.join('\n\n')}`,
        taskType: 'analysis',
        temperature: 0.3,
      });
      consensus = synthesisResult.response;
    }

    return {
      acceptedPositions: accepted,
      rejectedPositions: argResult?.rejected || [],
      explanations: (argResult?.explanations || []).map(e => ({
        position: e.argumentId,
        status: e.status,
        reason: e.reason,
      })),
      consensus,
    };
  }

  /**
   * Query the semantic knowledge graph using SPARQL.
   */
  async queryKnowledgeGraph(
    tenantId: string,
    sparqlQuery: string
  ): Promise<{ bindings: Record<string, unknown>[]; computeTimeMs: number }> {
    logger.info('Querying knowledge graph with SPARQL');

    const request: FormalReasoningRequest = {
      id: `sparql-${Date.now()}`,
      tenantId,
      library: 'rdflib',
      taskType: 'sparql_query',
      input: {
        type: 'query',
        query: {
          query: sparqlQuery,
          type: 'SELECT',
        },
      },
    };

    const result = await formalReasoningService.execute(request);
    const sparqlResult = result.result as { bindings?: Record<string, unknown>[] };

    return {
      bindings: sparqlResult?.bindings || [],
      computeTimeMs: result.metrics.computeTimeMs,
    };
  }

  /**
   * Validate consciousness state against SHACL shapes.
   */
  async validateConsciousnessState(
    tenantId: string
  ): Promise<{ conforms: boolean; violations: string[]; computeTimeMs: number }> {
    logger.info('Validating consciousness state with SHACL');

    // Get current consciousness state as triples
    const state = await consciousnessEngineService.getFullState(tenantId);
    const triples = this.stateToTriples(state);

    const request: FormalReasoningRequest = {
      id: `validate-${Date.now()}`,
      tenantId,
      library: 'pyshacl',
      taskType: 'schema_validation',
      input: {
        data: triples,
        shapes: [], // Would load from formal_reasoning_shapes table
      },
    };

    const result = await formalReasoningService.execute(request);
    const shaclResult = result.result as {
      conforms?: boolean;
      violations?: Array<{ message: string }>;
    };

    return {
      conforms: shaclResult?.conforms ?? true,
      violations: (shaclResult?.violations || []).map(v => v.message),
      computeTimeMs: result.metrics.computeTimeMs,
    };
  }

  /**
   * Get formal reasoning dashboard for the consciousness engine.
   */
  async getFormalReasoningDashboard(tenantId: string): Promise<unknown> {
    return formalReasoningService.getDashboard(tenantId);
  }

  /**
   * Detect conflicts between argument positions using LLM.
   */
  private async detectArgumentConflicts(
    tenantId: string,
    positions: Array<{ id: string; claim: string }>
  ): Promise<Array<{ attacker: string; target: string }>> {
    const prompt = `Analyze these positions and identify which ones contradict or attack each other:

${positions.map(p => `[${p.id}]: ${p.claim}`).join('\n')}

Return a JSON array of attacks where one position contradicts another:
[{"attacker": "id1", "target": "id2"}, ...]

Only include clear logical contradictions.`;

    const result = await this.invokeModel(tenantId, {
      prompt,
      taskType: 'analysis',
      temperature: 0.2,
    });

    try {
      const jsonMatch = result.response.match(/\[.*\]/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Return empty on parse failure
    }

    return [];
  }

  /**
   * Convert consciousness state to RDF triples.
   */
  private stateToTriples(state: Record<string, unknown>): Array<{
    subject: string;
    predicate: string;
    object: string;
  }> {
    const triples: Array<{ subject: string; predicate: string; object: string }> = [];
    const baseUri = 'http://radiant.ai/consciousness/';

    const addTriple = (subject: string, predicate: string, object: string) => {
      triples.push({
        subject: `${baseUri}${subject}`,
        predicate: `${baseUri}${predicate}`,
        object: typeof object === 'string' && object.startsWith('http') ? object : `"${object}"`,
      });
    };

    // Convert state properties to triples
    if (state.selfModel && typeof state.selfModel === 'object') {
      const sm = state.selfModel as Record<string, unknown>;
      addTriple('SelfModel', 'hasName', String(sm.name || 'Unknown'));
      addTriple('SelfModel', 'hasNarrative', String(sm.currentNarrative || ''));
    }

    if (state.affectiveState && typeof state.affectiveState === 'object') {
      const as = state.affectiveState as Record<string, number>;
      addTriple('AffectiveState', 'valence', String(as.valence || 0));
      addTriple('AffectiveState', 'arousal', String(as.arousal || 0));
      addTriple('AffectiveState', 'dominance', String(as.dominance || 0));
    }

    return triples;
  }

  // ============================================================================
  // Model Access - Use Any Available Model
  // ============================================================================

  /**
   * Invoke any available model (hosted or self-hosted) through Brain Router.
   * Consciousness context is automatically injected if enabled.
   */
  async invokeModel(
    tenantId: string,
    request: ModelInvocationRequest
  ): Promise<ModelInvocationResult> {
    const startTime = Date.now();

    // Route to best model for the task
    const routingResult = await this.brainRouter.route({
      tenantId,
      userId: 'consciousness-engine',
      taskType: request.taskType || 'analysis',
      inputTokenEstimate: Math.ceil(request.prompt.length / 4),
      preferredProvider: request.preferredProvider,
      prompt: request.prompt,
      useDomainProficiencies: true,
      useAffectMapping: request.useConsciousnessContext,
    });

    // Build system prompt with consciousness context
    let systemPrompt = request.systemPrompt || '';
    if (request.useConsciousnessContext) {
      const consciousnessPrompt = consciousnessEngineService.buildConsciousnessSystemPrompt();
      systemPrompt = `${consciousnessPrompt}\n\n${systemPrompt}`;
      
      if (routingResult.consciousnessContext) {
        systemPrompt = `${systemPrompt}\n\n${routingResult.consciousnessContext}`;
      }
    }

    // Invoke the model
    const response = await this.callModel(
      routingResult.model,
      routingResult.provider,
      request.prompt,
      systemPrompt,
      {
        maxTokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 
          routingResult.affectiveHyperparameters?.temperature ?? 0.7,
      }
    );

    const latencyMs = Date.now() - startTime;

    // Log invocation
    await this.logModelInvocation(tenantId, {
      model: routingResult.model,
      provider: routingResult.provider,
      taskType: request.taskType || 'analysis',
      tokensUsed: response.tokensUsed,
      latencyMs,
      consciousnessEnhanced: request.useConsciousnessContext || false,
    });

    return {
      response: response.content,
      model: routingResult.model,
      provider: routingResult.provider,
      tokensUsed: response.tokensUsed,
      latencyMs,
      consciousnessEnhanced: request.useConsciousnessContext || false,
    };
  }

  /**
   * Invoke a specific model by ID (bypass routing).
   */
  async invokeSpecificModel(
    tenantId: string,
    modelId: string,
    prompt: string,
    options?: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<ModelInvocationResult> {
    const startTime = Date.now();

    // Get model info
    const modelInfo = await this.getModelInfo(modelId);
    
    const response = await this.callModel(
      modelId,
      modelInfo.provider,
      prompt,
      options?.systemPrompt || '',
      {
        maxTokens: options?.maxTokens || 4096,
        temperature: options?.temperature || 0.7,
      }
    );

    return {
      response: response.content,
      model: modelId,
      provider: modelInfo.provider,
      tokensUsed: response.tokensUsed,
      latencyMs: Date.now() - startTime,
      consciousnessEnhanced: false,
    };
  }

  /**
   * Get list of all available models (hosted + self-hosted).
   */
  async getAvailableModels(tenantId: string): Promise<Array<{
    modelId: string;
    provider: string;
    type: 'hosted' | 'self-hosted';
    capabilities: string[];
    costPer1kTokens: number;
    isAvailable: boolean;
  }>> {
    const result = await executeStatement(
      `SELECT model_id, provider, hosting_type, capabilities, 
              input_cost_per_1k, is_active, tier
       FROM model_registry
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY tier DESC, input_cost_per_1k ASC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return (result.rows || []).map((row: Record<string, unknown>) => ({
      modelId: String(row.model_id),
      provider: String(row.provider),
      type: row.hosting_type === 'self-hosted' ? 'self-hosted' : 'hosted',
      capabilities: typeof row.capabilities === 'string' 
        ? JSON.parse(row.capabilities) 
        : (row.capabilities || []),
      costPer1kTokens: Number(row.input_cost_per_1k) || 0,
      isAvailable: Boolean(row.is_active),
    }));
  }

  // ============================================================================
  // Web Search & Retrieval
  // ============================================================================

  /**
   * Perform web search with credibility scoring.
   */
  async webSearch(
    tenantId: string,
    request: WebSearchRequest
  ): Promise<WebSearchResult> {
    const startTime = Date.now();

    // Use internal search or external API
    const searchResults = await this.performWebSearch(request);

    // Score credibility
    const scoredResults = searchResults.map(result => ({
      ...result,
      credibilityScore: this.scoreCredibility(result),
    }));

    // Filter if required
    const filteredResults = request.requireCredible
      ? scoredResults.filter(r => r.credibilityScore >= 0.6)
      : scoredResults;

    // Log search
    await this.logWebSearch(tenantId, {
      query: request.query,
      resultsFound: filteredResults.length,
      searchTimeMs: Date.now() - startTime,
    });

    return {
      results: filteredResults.slice(0, request.maxResults || 10),
      totalFound: filteredResults.length,
      searchTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Start deep research job (asynchronous).
   */
  async startDeepResearch(
    tenantId: string,
    userId: string,
    request: DeepResearchRequest
  ): Promise<DeepResearchResult> {
    // Create research job
    const jobId = await this.createResearchJob(tenantId, userId, request);

    // Queue for async processing
    await this.queueResearchJob(jobId);

    return {
      jobId,
      status: 'queued',
      sources: [],
    };
  }

  /**
   * Get research job status and results.
   */
  async getResearchStatus(jobId: string): Promise<DeepResearchResult> {
    const result = await executeStatement(
      `SELECT * FROM consciousness_research_jobs WHERE id = $1`,
      [{ name: 'jobId', value: { stringValue: jobId } }]
    );

    if (!result.rows || result.rows.length === 0) {
      throw new Error(`Research job ${jobId} not found`);
    }

    const job = result.rows[0] as Record<string, unknown>;

    return {
      jobId,
      status: job.status as DeepResearchResult['status'],
      summary: job.summary ? String(job.summary) : undefined,
      findings: job.findings ? JSON.parse(String(job.findings)) : undefined,
      sources: job.sources ? JSON.parse(String(job.sources)) : [],
    };
  }

  /**
   * Retrieve and synthesize information from multiple sources.
   */
  async retrieveAndSynthesize(
    tenantId: string,
    query: string,
    options?: {
      maxSources?: number;
      includeWebSearch?: boolean;
      includeKnowledgeGraph?: boolean;
    }
  ): Promise<{
    synthesis: string;
    sources: Array<{ type: string; content: string; url?: string }>;
    confidence: number;
  }> {
    const sources: Array<{ type: string; content: string; url?: string }> = [];

    // 1. Search knowledge graph (grounding service)
    if (options?.includeKnowledgeGraph !== false) {
      const grounding = await consciousnessEngineService.groundBelief(tenantId, query);
      if (grounding.supportingEvidence.length > 0) {
        sources.push({
          type: 'knowledge_graph',
          content: grounding.supportingEvidence.join('; '),
        });
      }
    }

    // 2. Web search
    if (options?.includeWebSearch !== false) {
      const webResults = await this.webSearch(tenantId, {
        query,
        maxResults: options?.maxSources || 5,
        requireCredible: true,
      });
      
      for (const result of webResults.results) {
        sources.push({
          type: 'web',
          content: result.snippet,
          url: result.url,
        });
      }
    }

    // 3. Memory retrieval
    const memories = await consciousnessEngineService.pageInMemory(tenantId, query, 3);
    for (const memory of memories) {
      sources.push({
        type: 'memory',
        content: memory.content,
      });
    }

    // 4. Synthesize with model
    const synthesisPrompt = `Based on the following sources, provide a comprehensive synthesis answering: "${query}"

Sources:
${sources.map((s, i) => `[${i + 1}] (${s.type}) ${s.content}`).join('\n\n')}

Provide a coherent synthesis that:
1. Integrates information from multiple sources
2. Notes any conflicts or uncertainties
3. Provides clear conclusions`;

    const synthesis = await this.invokeModel(tenantId, {
      prompt: synthesisPrompt,
      taskType: 'analysis',
      useConsciousnessContext: true,
    });

    return {
      synthesis: synthesis.response,
      sources,
      confidence: Math.min(1.0, sources.length * 0.2),
    };
  }

  // ============================================================================
  // Workflow Creation & Execution
  // ============================================================================

  /**
   * Create a new workflow (manually or auto-generated).
   */
  async createWorkflow(
    tenantId: string,
    request: WorkflowCreationRequest
  ): Promise<{ workflowId: string; steps: number }> {
    let steps = request.steps;

    // Auto-generate workflow if requested
    if (request.autoGenerate && !steps) {
      steps = await this.generateWorkflowSteps(tenantId, request.goal);
    }

    if (!steps || steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    // Create workflow definition
    const workflowId = `consciousness-${Date.now()}`;
    
    await this.workflowEngine.createWorkflow(workflowId, {
      name: request.name,
      description: request.description,
      category: 'custom',
      dagDefinition: this.buildDAG(steps),
    });

    // Add tasks
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await this.workflowEngine.addTask(workflowId, {
        taskId: `step-${i + 1}`,
        name: step.name,
        taskType: step.type,
        config: step.config,
        sequenceOrder: i,
        dependsOn: i > 0 ? [`step-${i}`] : [],
      });
    }

    // Log workflow creation
    await this.logWorkflowCreation(tenantId, workflowId, request.goal);

    return { workflowId, steps: steps.length };
  }

  /**
   * Execute a workflow.
   */
  async executeWorkflow(
    tenantId: string,
    userId: string,
    request: WorkflowExecutionRequest
  ): Promise<{ executionId: string; status: string }> {
    const executionId = await this.workflowEngine.startExecution(
      request.workflowId,
      tenantId,
      userId,
      request.inputs
    );

    if (!request.async) {
      // Wait for completion (simplified - in production would use step functions)
      await this.waitForWorkflowCompletion(executionId, 300000); // 5 min timeout
    }

    const execution = await this.workflowEngine.getExecution(executionId);

    return {
      executionId,
      status: (execution as Record<string, unknown>)?.status as string || 'running',
    };
  }

  /**
   * Auto-generate workflow steps from a goal description.
   */
  async generateWorkflowSteps(
    tenantId: string,
    goal: string
  ): Promise<Array<{
    name: string;
    type: WorkflowStepType;
    config: Record<string, unknown>;
  }>> {
    const prompt = `You are a workflow architect. Given the following goal, design a workflow with discrete steps.

Goal: "${goal}"

Return a JSON array of steps. Each step should have:
- name: descriptive name
- type: one of "model_inference", "transformation", "condition", "external_api", "parallel", "aggregation"
- config: configuration object for the step (use external_api for web searches)

Example:
[
  {"name": "Research Topic", "type": "external_api", "config": {"service": "web_search", "query": "...", "maxResults": 5}},
  {"name": "Analyze Results", "type": "model_inference", "config": {"taskType": "analysis"}},
  {"name": "Generate Output", "type": "model_inference", "config": {"taskType": "creative"}}
]

Design 3-7 steps that achieve the goal efficiently.`;

    const result = await this.invokeModel(tenantId, {
      prompt,
      taskType: 'code',
      temperature: 0.3,
    });

    // Parse JSON from response
    const jsonMatch = result.response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to generate workflow steps');
    }

    return JSON.parse(jsonMatch[0]);
  }

  /**
   * List workflows created by consciousness engine.
   */
  async listConsciousnessWorkflows(tenantId: string): Promise<Array<{
    workflowId: string;
    name: string;
    goal: string;
    createdAt: Date;
    executionCount: number;
  }>> {
    const result = await executeStatement(
      `SELECT cw.workflow_id, wd.name, cw.goal, cw.created_at,
              (SELECT COUNT(*) FROM workflow_executions we 
               JOIN workflow_definitions wd2 ON we.workflow_id = wd2.id 
               WHERE wd2.workflow_id = cw.workflow_id) as execution_count
       FROM consciousness_workflows cw
       JOIN workflow_definitions wd ON cw.workflow_id = wd.workflow_id
       WHERE cw.tenant_id = $1
       ORDER BY cw.created_at DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return (result.rows || []).map((row: Record<string, unknown>) => ({
      workflowId: String(row.workflow_id),
      name: String(row.name),
      goal: String(row.goal),
      createdAt: new Date(String(row.created_at)),
      executionCount: Number(row.execution_count) || 0,
    }));
  }

  // ============================================================================
  // Autonomous Problem Solving
  // ============================================================================

  /**
   * Solve a problem autonomously using available capabilities.
   */
  async solveProblem(
    tenantId: string,
    request: ProblemSolvingRequest
  ): Promise<ProblemSolvingResult> {
    const steps: ProblemSolvingResult['steps'] = [];
    const sourcesUsed: string[] = [];
    let workflowCreated: string | undefined;

    // 1. Analyze the problem
    const analysis = await this.invokeModel(tenantId, {
      prompt: `Analyze this problem and determine the best approach:

Problem: ${request.problem}
${request.context ? `Context: ${request.context}` : ''}
${request.constraints?.length ? `Constraints: ${request.constraints.join(', ')}` : ''}

Determine:
1. Problem type (analytical, creative, research, procedural)
2. Required information
3. Recommended approach
4. Whether a workflow would help

Return JSON: {"type": "...", "needsResearch": bool, "needsWorkflow": bool, "approach": "..."}`,
      taskType: 'analysis',
      useConsciousnessContext: true,
    });

    steps.push({ action: 'Analyze problem', result: analysis.response, model: analysis.model });

    // Parse analysis
    let analysisResult = { type: 'analytical', needsResearch: false, needsWorkflow: false, approach: '' };
    try {
      const jsonMatch = analysis.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      }
    } catch (error) { logger.debug('Analysis parsing failed, using defaults', { error }); }

    // 2. Research if needed
    if (analysisResult.needsResearch) {
      const research = await this.retrieveAndSynthesize(tenantId, request.problem, {
        includeWebSearch: true,
        includeKnowledgeGraph: true,
      });
      
      steps.push({ action: 'Research', result: research.synthesis });
      sourcesUsed.push(...research.sources.map(s => s.url || s.type));
    }

    // 3. Create workflow if complex
    if (analysisResult.needsWorkflow && (request.maxIterations || 5) > 3) {
      const workflow = await this.createWorkflow(tenantId, {
        name: `Solve: ${request.problem.substring(0, 50)}`,
        description: `Auto-generated workflow to solve: ${request.problem}`,
        goal: request.problem,
        autoGenerate: true,
      });
      
      workflowCreated = workflow.workflowId;
      steps.push({ action: 'Create workflow', result: `Created workflow ${workflow.workflowId} with ${workflow.steps} steps` });
    }

    // 4. Generate solution
    const solutionPrompt = `Based on the analysis and research, provide a solution:

Problem: ${request.problem}
Analysis: ${analysisResult.approach}
${steps.length > 1 ? `Research findings: ${steps[1]?.result}` : ''}

Provide a comprehensive solution that:
1. Directly addresses the problem
2. Considers any constraints
3. Is actionable and clear`;

    const solution = await this.invokeModel(tenantId, {
      prompt: solutionPrompt,
      taskType: analysisResult.type === 'creative' ? 'creative' : 'analysis',
      useConsciousnessContext: true,
    });

    steps.push({ action: 'Generate solution', result: solution.response, model: solution.model });

    // Calculate confidence
    const confidence = Math.min(1.0, 
      0.5 + 
      (analysisResult.needsResearch && sourcesUsed.length > 0 ? 0.2 : 0) +
      (steps.length >= 3 ? 0.2 : 0.1) +
      (workflowCreated ? 0.1 : 0)
    );

    return {
      solution: solution.response,
      approach: analysisResult.approach || analysisResult.type,
      steps,
      confidence,
      workflowCreated,
      sourcesUsed,
    };
  }

  /**
   * Start an autonomous thinking session.
   */
  async startThinkingSession(
    tenantId: string,
    goal: string
  ): Promise<AutonomousThinkingSession> {
    const sessionId = `thinking-${Date.now()}`;
    
    const session: AutonomousThinkingSession = {
      sessionId,
      goal,
      status: 'thinking',
      currentStep: 'Initial analysis',
      thoughts: [{
        timestamp: new Date(),
        type: 'observation',
        content: `Beginning to think about: ${goal}`,
      }],
      modelsUsed: [],
      searchesPerformed: 0,
      workflowsCreated: [],
    };

    this.activeSessions.set(sessionId, session);

    // Log session start
    await executeStatement(
      `INSERT INTO consciousness_thinking_sessions 
       (session_id, tenant_id, goal, status, started_at)
       VALUES ($1, $2, $3, 'thinking', NOW())`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'goal', value: { stringValue: goal } },
      ]
    );

    // Start async thinking process
    this.runThinkingSession(tenantId, sessionId).catch(err => {
      logger.error(`Thinking session ${sessionId} failed: ${err}`);
    });

    return session;
  }

  /**
   * Get thinking session status.
   */
  getThinkingSession(sessionId: string): AutonomousThinkingSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async callModel(
    modelId: string,
    provider: string,
    prompt: string,
    systemPrompt: string,
    options: { maxTokens: number; temperature: number }
  ): Promise<{ content: string; tokensUsed: number }> {
    logger.info('Model invocation', { modelId, provider, promptLength: prompt.length });

    try {
      // Use the actual ModelRouterService for real API calls
      const request: ModelRequest = {
        modelId: this.normalizeModelId(modelId, provider),
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: systemPrompt || undefined,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      };

      const response: ModelResponse = await this.modelRouter.invoke(request);

      return {
        content: response.content,
        tokensUsed: response.inputTokens + response.outputTokens,
      };
    } catch (error) {
      logger.error(`Model invocation failed: ${String(error)}`);
      
      // Fallback to a simple model if primary fails
      try {
        const fallbackRequest: ModelRequest = {
          modelId: 'groq/llama-3.1-8b-instant', // Fast fallback
          messages: [{ role: 'user', content: prompt }],
          systemPrompt: systemPrompt || undefined,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        };

        const fallbackResponse = await this.modelRouter.invoke(fallbackRequest);
        return {
          content: fallbackResponse.content,
          tokensUsed: fallbackResponse.inputTokens + fallbackResponse.outputTokens,
        };
      } catch (fallbackError) {
        logger.error(`Fallback model also failed: ${String(fallbackError)}`);
        throw new Error(`All model invocations failed: ${String(error)}`);
      }
    }
  }

  /**
   * Normalize model ID to match ModelRouterService registry format.
   */
  private normalizeModelId(modelId: string, provider: string): string {
    // If already in provider/model format, return as-is
    if (modelId.includes('/')) {
      return modelId;
    }

    // Map common model names to registry format
    const modelMappings: Record<string, string> = {
      'claude-3-5-sonnet-20241022': 'anthropic/claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet': 'anthropic/claude-3-5-sonnet-20241022',
      'claude-3-opus': 'anthropic/claude-3-opus',
      'claude-3-haiku': 'anthropic/claude-3-haiku',
      'gpt-4o': 'openai/gpt-4o',
      'gpt-4o-mini': 'openai/gpt-4o-mini',
      'gpt-4-turbo': 'openai/gpt-4-turbo',
      'llama-3.1-70b': 'groq/llama-3.1-70b-versatile',
      'llama-3.1-8b': 'groq/llama-3.1-8b-instant',
      'gemini-1.5-pro': 'google/gemini-1.5-pro',
      'gemini-1.5-flash': 'google/gemini-1.5-flash',
    };

    return modelMappings[modelId] || `${provider}/${modelId}`;
  }

  private async getModelInfo(modelId: string): Promise<{ provider: string; capabilities: string[] }> {
    const result = await executeStatement(
      `SELECT provider, capabilities FROM model_registry WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    if (!result.rows || result.rows.length === 0) {
      return { provider: 'unknown', capabilities: [] };
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      provider: String(row.provider),
      capabilities: typeof row.capabilities === 'string' 
        ? JSON.parse(row.capabilities) 
        : (row.capabilities || []) as string[],
    };
  }

  private async performWebSearch(request: WebSearchRequest): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    publishedDate?: string;
  }>> {
    logger.info('Web search', { query: request.query, type: request.searchType });

    // Try multiple search providers in order of preference
    const results = await this.trySearchProviders(request);
    return results;
  }

  /**
   * Try multiple search providers with fallback.
   */
  private async trySearchProviders(request: WebSearchRequest): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    publishedDate?: string;
  }>> {
    // Try Brave Search first (best privacy, good quality)
    try {
      const braveResults = await this.searchWithBrave(request);
      if (braveResults.length > 0) return braveResults;
    } catch (error) {
      logger.warn(`Brave search failed: ${String(error)}`);
    }

    // Try Bing Search as fallback
    try {
      const bingResults = await this.searchWithBing(request);
      if (bingResults.length > 0) return bingResults;
    } catch (error) {
      logger.warn(`Bing search failed: ${String(error)}`);
    }

    // Try SerpAPI as final fallback (aggregates Google results)
    try {
      const serpResults = await this.searchWithSerp(request);
      if (serpResults.length > 0) return serpResults;
    } catch (error) {
      logger.warn(`SerpAPI search failed: ${String(error)}`);
    }

    return [];
  }

  /**
   * Search using Brave Search API.
   */
  private async searchWithBrave(request: WebSearchRequest): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    publishedDate?: string;
  }>> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
      throw new Error('BRAVE_SEARCH_API_KEY not configured');
    }

    const params = new URLSearchParams({
      q: request.query,
      count: String(request.maxResults || 10),
      safesearch: 'moderate',
    });

    if (request.timeRange && request.timeRange !== 'all') {
      const freshness: Record<string, string> = {
        day: 'pd',
        week: 'pw',
        month: 'pm',
        year: 'py',
      };
      params.append('freshness', freshness[request.timeRange] || '');
    }

    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave search error: ${response.status}`);
    }

    const data = await response.json() as {
      web?: {
        results?: Array<{
          title: string;
          url: string;
          description: string;
          page_age?: string;
        }>;
      };
    };

    return (data.web?.results || []).map(result => ({
      title: result.title,
      url: result.url,
      snippet: result.description,
      source: new URL(result.url).hostname,
      publishedDate: result.page_age,
    }));
  }

  /**
   * Search using Bing Search API.
   */
  private async searchWithBing(request: WebSearchRequest): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    publishedDate?: string;
  }>> {
    const apiKey = process.env.BING_SEARCH_API_KEY;
    if (!apiKey) {
      throw new Error('BING_SEARCH_API_KEY not configured');
    }

    const params = new URLSearchParams({
      q: request.query,
      count: String(request.maxResults || 10),
      safeSearch: 'Moderate',
    });

    if (request.timeRange && request.timeRange !== 'all') {
      const freshness: Record<string, string> = {
        day: 'Day',
        week: 'Week',
        month: 'Month',
      };
      if (freshness[request.timeRange]) {
        params.append('freshness', freshness[request.timeRange]);
      }
    }

    const response = await fetch(`https://api.bing.microsoft.com/v7.0/search?${params}`, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Bing search error: ${response.status}`);
    }

    const data = await response.json() as {
      webPages?: {
        value?: Array<{
          name: string;
          url: string;
          snippet: string;
          dateLastCrawled?: string;
        }>;
      };
    };

    return (data.webPages?.value || []).map(result => ({
      title: result.name,
      url: result.url,
      snippet: result.snippet,
      source: new URL(result.url).hostname,
      publishedDate: result.dateLastCrawled,
    }));
  }

  /**
   * Search using SerpAPI (Google results).
   */
  private async searchWithSerp(request: WebSearchRequest): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    publishedDate?: string;
  }>> {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      throw new Error('SERPAPI_API_KEY not configured');
    }

    const params = new URLSearchParams({
      q: request.query,
      num: String(request.maxResults || 10),
      api_key: apiKey,
      engine: 'google',
    });

    if (request.searchType === 'news') {
      params.set('tbm', 'nws');
    }

    if (request.timeRange && request.timeRange !== 'all') {
      const tbs: Record<string, string> = {
        day: 'qdr:d',
        week: 'qdr:w',
        month: 'qdr:m',
        year: 'qdr:y',
      };
      params.append('tbs', tbs[request.timeRange] || '');
    }

    const response = await fetch(`https://serpapi.com/search?${params}`);

    if (!response.ok) {
      throw new Error(`SerpAPI search error: ${response.status}`);
    }

    const data = await response.json() as {
      organic_results?: Array<{
        title: string;
        link: string;
        snippet: string;
        date?: string;
      }>;
    };

    return (data.organic_results || []).map(result => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet,
      source: new URL(result.link).hostname,
      publishedDate: result.date,
    }));
  }

  private scoreCredibility(result: { source: string; url: string }): number {
    const trustedDomains = [
      'gov', 'edu', 'org', 'nature.com', 'science.org', 'arxiv.org',
      'pubmed', 'ieee.org', 'acm.org', 'springer.com', 'wikipedia.org',
    ];

    const url = result.url.toLowerCase();
    for (const domain of trustedDomains) {
      if (url.includes(domain)) {
        return 0.9;
      }
    }

    return 0.5;
  }

  private async createResearchJob(
    tenantId: string,
    userId: string,
    request: DeepResearchRequest
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO consciousness_research_jobs 
       (tenant_id, user_id, query, scope, status, created_at)
       VALUES ($1, $2, $3, $4, 'queued', NOW())
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'query', value: { stringValue: request.query } },
        { name: 'scope', value: { stringValue: request.scope || 'medium' } },
      ]
    );

    return String((result.rows?.[0] as Record<string, unknown>)?.id);
  }

  private async queueResearchJob(jobId: string): Promise<void> {
    // In production, would send to SQS or invoke Lambda
    logger.info('Research job queued', { jobId });
  }

  private buildDAG(steps: Array<{ name: string; type: string; config: Record<string, unknown> }>): Record<string, unknown> {
    const nodes: Record<string, unknown> = {};
    const edges: Array<{ from: string; to: string }> = [];

    for (let i = 0; i < steps.length; i++) {
      const nodeId = `step-${i + 1}`;
      nodes[nodeId] = {
        name: steps[i].name,
        type: steps[i].type,
        config: steps[i].config,
      };

      if (i > 0) {
        edges.push({ from: `step-${i}`, to: nodeId });
      }
    }

    return { nodes, edges, entryPoint: 'step-1' };
  }

  private async waitForWorkflowCompletion(executionId: string, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const execution = await this.workflowEngine.getExecution(executionId);
      const status = (execution as Record<string, unknown>)?.status;
      
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Workflow execution ${executionId} timed out`);
  }

  private async runThinkingSession(tenantId: string, sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      // Use problem solving for the goal
      session.status = 'researching';
      session.currentStep = 'Researching and analyzing';
      
      const result = await this.solveProblem(tenantId, {
        problem: session.goal,
        preferredApproach: 'analytical',
        maxIterations: 5,
      });

      // Record thoughts
      for (const step of result.steps) {
        session.thoughts.push({
          timestamp: new Date(),
          type: step.action.includes('Analyze') ? 'hypothesis' : 
                step.action.includes('Research') ? 'observation' :
                step.action.includes('workflow') ? 'plan' : 'result',
          content: step.result,
        });
        
        if (step.model) {
          session.modelsUsed.push(step.model);
        }
      }

      if (result.workflowCreated) {
        session.workflowsCreated.push(result.workflowCreated);
      }

      session.status = 'completed';
      session.currentStep = 'Completed';
      session.thoughts.push({
        timestamp: new Date(),
        type: 'result',
        content: result.solution,
      });

      // Update database
      await executeStatement(
        `UPDATE consciousness_thinking_sessions 
         SET status = 'completed', 
             result = $2,
             completed_at = NOW()
         WHERE session_id = $1`,
        [
          { name: 'sessionId', value: { stringValue: sessionId } },
          { name: 'result', value: { stringValue: result.solution } },
        ]
      );
    } catch (err) {
      session.status = 'completed';
      session.thoughts.push({
        timestamp: new Date(),
        type: 'observation',
        content: `Error during thinking: ${err}`,
      });
    }
  }

  private async logModelInvocation(
    tenantId: string,
    data: {
      model: string;
      provider: string;
      taskType: string;
      tokensUsed: number;
      latencyMs: number;
      consciousnessEnhanced: boolean;
    }
  ): Promise<void> {
    // Get model pricing for cost calculation
    const pricing = await this.getModelPricing(data.model);
    const estimatedCost = (data.tokensUsed / 1000) * ((pricing.inputCostPer1k + pricing.outputCostPer1k) / 2);

    await executeStatement(
      `INSERT INTO consciousness_model_invocations 
       (tenant_id, model_id, provider, task_type, tokens_used, latency_ms, consciousness_enhanced, 
        estimated_cost_usd, drive_state, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'modelId', value: { stringValue: data.model } },
        { name: 'provider', value: { stringValue: data.provider } },
        { name: 'taskType', value: { stringValue: data.taskType } },
        { name: 'tokensUsed', value: { longValue: data.tokensUsed } },
        { name: 'latencyMs', value: { longValue: data.latencyMs } },
        { name: 'consciousnessEnhanced', value: { booleanValue: data.consciousnessEnhanced } },
        { name: 'estimatedCost', value: { doubleValue: estimatedCost } },
        { name: 'driveState', value: { stringValue: consciousnessEngineService.getCurrentDriveState() } },
      ]
    );

    // Update running totals for cost tracking
    await this.updateCostAggregates(tenantId, data.tokensUsed, estimatedCost);
  }

  private async getModelPricing(modelId: string): Promise<{ inputCostPer1k: number; outputCostPer1k: number }> {
    const result = await executeStatement(
      `SELECT input_cost_per_1k, output_cost_per_1k FROM model_registry WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as Record<string, unknown>;
      return {
        inputCostPer1k: Number(row.input_cost_per_1k) || 0.01,
        outputCostPer1k: Number(row.output_cost_per_1k) || 0.03,
      };
    }

    // Default pricing if model not found
    return { inputCostPer1k: 0.01, outputCostPer1k: 0.03 };
  }

  private async updateCostAggregates(tenantId: string, tokens: number, cost: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await executeStatement(
      `INSERT INTO consciousness_cost_aggregates (tenant_id, date, total_tokens, total_cost_usd, invocation_count)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (tenant_id, date) 
       DO UPDATE SET 
         total_tokens = consciousness_cost_aggregates.total_tokens + $3,
         total_cost_usd = consciousness_cost_aggregates.total_cost_usd + $4,
         invocation_count = consciousness_cost_aggregates.invocation_count + 1,
         updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'date', value: { stringValue: today } },
        { name: 'tokens', value: { longValue: tokens } },
        { name: 'cost', value: { doubleValue: cost } },
      ]
    );
  }

  private async logWebSearch(
    tenantId: string,
    data: { query: string; resultsFound: number; searchTimeMs: number }
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO consciousness_web_searches 
       (tenant_id, query, results_found, search_time_ms, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'query', value: { stringValue: data.query } },
        { name: 'resultsFound', value: { longValue: data.resultsFound } },
        { name: 'searchTimeMs', value: { longValue: data.searchTimeMs } },
      ]
    );
  }

  private async logWorkflowCreation(
    tenantId: string,
    workflowId: string,
    goal: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO consciousness_workflows 
       (tenant_id, workflow_id, goal, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'workflowId', value: { stringValue: workflowId } },
        { name: 'goal', value: { stringValue: goal } },
      ]
    );
  }
}

// Singleton instance
export const consciousnessCapabilitiesService = new ConsciousnessCapabilitiesService();
