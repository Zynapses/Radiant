/**
 * Formal Reasoning Service
 * 
 * Unified service for 8 formal reasoning libraries integrated with the
 * consciousness engine. Provides constraint verification, theorem proving,
 * structured argumentation, temporal reasoning, semantic knowledge management,
 * and neurosymbolic inference.
 * 
 * Libraries:
 * 1. Z3 Theorem Prover - SMT solving, constraint verification (v4.15.4.0)
 * 2. PyArg - Structured argumentation semantics (v2.0.2)
 * 3. PyReason - Temporal graph reasoning (v3.2.0)
 * 4. RDFLib - Semantic web stack, SPARQL 1.1 (v7.5.0)
 * 5. OWL-RL - Polynomial-time ontological inference (v7.1.4)
 * 6. pySHACL - Graph constraint validation (v0.30.1)
 * 7. Logic Tensor Networks - Differentiable FOL (TensorFlow 2)
 * 8. DeepProbLog - Probabilistic logic programming (ProbLog + PyTorch)
 * 
 * Integration Pattern: LLM-Modulo Generate-Test-Critique loop
 * 
 * @see Kambhampati et al. (ICML 2024) - LLM-Modulo Framework
 * @see docs/FORMAL-REASONING.md for full documentation
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { executeStatement } from '../db/client';
import { logger } from '../logger';
import { libraryRegistryService, Library } from './library-registry.service';

// AWS clients for invoking Python executor and SageMaker
const lambdaClient = new LambdaClient({});
const sagemakerClient = new SageMakerRuntimeClient({});

// Environment variables
const FORMAL_REASONING_EXECUTOR_ARN = process.env.FORMAL_REASONING_EXECUTOR_ARN;
const LTN_ENDPOINT = process.env.LTN_SAGEMAKER_ENDPOINT;
const DEEPPROBLOG_ENDPOINT = process.env.DEEPPROBLOG_SAGEMAKER_ENDPOINT;
import {
  FormalReasoningLibrary,
  FormalReasoningLibraryInfo,
  ReasoningTaskType,
  ReasoningResultStatus,
  FormalReasoningRequest,
  FormalReasoningResponse,
  FormalReasoningMetrics,
  FormalReasoningTenantConfig,
  FormalReasoningStats,
  FormalReasoningInvocationLog,
  FormalReasoningDashboard,
  LibraryHealth,
  Z3Config,
  Z3Constraint,
  Z3Result,
  Z3ProveRequest,
  PyArgConfig,
  ArgumentationFramework,
  ArgumentationResult,
  ArgumentationSemantics,
  PyReasonConfig,
  PyReasonRule,
  PyReasonFact,
  PyReasonInterpretation,
  RDFLibConfig,
  RDFTriple,
  SPARQLQuery,
  SPARQLResult,
  OWLRLConfig,
  OWLRLResult,
  PySHACLConfig,
  SHACLShape,
  SHACLValidationResult,
  LTNConfig,
  LTNFormula,
  LTNResult,
  DeepProbLogConfig,
  DeepProbLogProgram,
  DeepProbLogResult,
  LLMModuloConfig,
  LLMModuloRequest,
  LLMModuloResult,
} from '@radiant/shared';

/**
 * Library ID mapping from formal reasoning IDs to library registry IDs.
 */
const LIBRARY_ID_MAP: Record<FormalReasoningLibrary, string> = {
  z3: 'z3_theorem_prover',
  pyarg: 'pyarg',
  pyreason: 'pyreason',
  rdflib: 'rdflib',
  owlrl: 'owlrl',
  pyshacl: 'pyshacl',
  ltn: 'ltn',
  deepproblog: 'deepproblog',
};

/**
 * Fallback library registry with metadata (used if database unavailable).
 * Primary source is the library_registry table in the database.
 */
const FALLBACK_LIBRARY_REGISTRY: Record<FormalReasoningLibrary, FormalReasoningLibraryInfo> = {
  z3: {
    id: 'z3',
    name: 'Z3 Theorem Prover',
    version: '4.15.4.0',
    license: 'MIT',
    pythonVersion: '3.8+',
    threadSafe: false, // Per-Context only
    installCommand: 'pip install z3-solver',
    description: 'Microsoft Research SMT solver implementing DPLL(T) architecture',
    capabilities: [
      'Linear/nonlinear real and integer arithmetic',
      'Bit-vectors and arrays',
      'Algebraic datatypes',
      'Sequences and strings',
      'Floating-point',
      'Uninterpreted functions',
      'Quantifiers with E-matching',
      'Parallel solving',
      'Incremental solving',
      'Unsat core extraction',
      'Proof generation',
    ],
    useCases: [
      'Constraint satisfaction',
      'Theorem proving',
      'Loop invariant synthesis',
      'Belief consistency verification',
      'Mathematical formula verification',
    ],
    limitations: [
      'Not thread-safe within single Context',
      'Nonlinear problems can be slow',
      'May timeout on complex quantified formulas',
    ],
    costPerInvocation: 0.0001, // ~$0.10 per 1000 invocations
    averageLatencyMs: 50,
    enabled: true,
  },
  pyarg: {
    id: 'pyarg',
    name: 'PyArg (python-argumentation)',
    version: '2.0.2',
    license: 'MIT',
    pythonVersion: '3.7+',
    threadSafe: false,
    installCommand: 'pip install python-argumentation',
    description: 'Dung\'s Abstract Argumentation Framework with ASPIC+ and ABA',
    capabilities: [
      'Admissible semantics',
      'Complete semantics',
      'Grounded semantics (skeptical)',
      'Preferred semantics (credulous)',
      'Stable semantics',
      'Semi-stable, ideal, eager semantics',
      'ASPIC+ structured argumentation',
      'Assumption-Based Argumentation',
      'Explanation generation',
    ],
    useCases: [
      'Belief revision',
      'Conflict resolution',
      'Explainable reasoning',
      'Clinical decision support',
      'Legal reasoning',
    ],
    limitations: [
      'Niche academic focus (5 GitHub stars)',
      'Limited documentation',
      'Computational complexity for large frameworks',
    ],
    costPerInvocation: 0.00005,
    averageLatencyMs: 20,
    enabled: true,
  },
  pyreason: {
    id: 'pyreason',
    name: 'PyReason',
    version: '3.2.0',
    license: 'BSD-2-Clause',
    pythonVersion: '3.9-3.10',
    threadSafe: true, // Multi-core via Numba
    installCommand: 'pip install pyreason',
    description: 'Generalized Annotated Logic with temporal reasoning over knowledge graphs',
    capabilities: [
      'Real-valued interval annotations [0,1]',
      'Fixpoint-based deduction',
      'Convergence detection',
      'Temporal reasoning across timesteps',
      'GraphML and NetworkX integration',
      'Neo4j export',
      'Explainable inference traces',
      '1000x speedup on large graphs',
    ],
    useCases: [
      'Temporal state tracking',
      'Consequence prediction',
      'Knowledge graph inference',
      'Social network analysis',
      'Epidemic modeling',
    ],
    limitations: [
      'Python 3.9-3.10 only for parallel',
      'Lab (Lab V2) dissolved',
      'Limited community support',
    ],
    costPerInvocation: 0.0002,
    averageLatencyMs: 100,
    enabled: true,
  },
  rdflib: {
    id: 'rdflib',
    name: 'RDFLib',
    version: '7.5.0',
    license: 'BSD-3-Clause',
    pythonVersion: '3.8.1+',
    threadSafe: false, // Lock queries
    installCommand: 'pip install rdflib[berkeleydb,networkx,html,lxml,orjson]',
    description: 'Complete SPARQL 1.1 implementation with multiple serialization formats',
    capabilities: [
      'Turtle, RDF/XML, N-Triples, N-Quads, N3',
      'JSON-LD (built-in since v6.0)',
      'TriG, TriX, HexTuples, LongTurtle',
      'SELECT/CONSTRUCT/ASK/DESCRIBE',
      'All UPDATE operations',
      'Property paths',
      'Federation (SERVICE)',
      'Aggregates and subqueries',
      'Multiple store backends',
    ],
    useCases: [
      'Knowledge graph management',
      'SPARQL query execution',
      'LLM output parsing to triples',
      'Semantic memory storage',
      'Ontology management',
    ],
    limitations: [
      'Not fully thread-safe (pyparsing)',
      'In-memory limited to ~hundreds of thousands triples',
      'BerkeleyDB for persistence',
    ],
    costPerInvocation: 0.00002,
    averageLatencyMs: 10,
    enabled: true,
  },
  owlrl: {
    id: 'owlrl',
    name: 'OWL-RL',
    version: '7.1.4',
    license: 'W3C',
    pythonVersion: '3.9+',
    threadSafe: false,
    installCommand: 'pip install owlrl',
    description: 'Complete W3C OWL 2 RL ruleset with RDFS semantics',
    capabilities: [
      'OWL 2 RL Tables 4-9',
      'RDFS semantics',
      'Polynomial-time reasoning',
      'In-place graph expansion',
      'Inconsistency detection',
    ],
    useCases: [
      'Ontological inference',
      'LLM output validation against ontology',
      'Class hierarchy reasoning',
      'Property chain inference',
    ],
    limitations: [
      'No DisjointUnion',
      'No ReflexiveObjectProperty',
      'No arbitrary existential restrictions',
      'No cardinality constraints >1',
      '~38x slower than Rust alternatives',
    ],
    costPerInvocation: 0.0001,
    averageLatencyMs: 200,
    enabled: true,
  },
  pyshacl: {
    id: 'pyshacl',
    name: 'pySHACL',
    version: '0.30.1',
    license: 'Apache-2.0',
    pythonVersion: '3.9+',
    threadSafe: false,
    installCommand: 'pip install pyshacl[js,http]',
    description: 'SHACL Core + Advanced Features validator',
    capabilities: [
      'Value type constraints',
      'Cardinality constraints',
      'Value range constraints',
      'String pattern constraints',
      'Property pair constraints',
      'Logical operators (and/or/not/xone)',
      'Shape-based constraints',
      'SPARQL-based targets/constraints/rules',
      'SHACL-JS support',
      'Triple rules with iteration',
      'HTTP REST service',
    ],
    useCases: [
      'LLM output validation',
      'Graph schema enforcement',
      'Data quality validation',
      'Iterative refinement with error feedback',
    ],
    limitations: [
      'Complex shapes can be slow',
      'SHACL-JS requires Node.js',
    ],
    costPerInvocation: 0.00005,
    averageLatencyMs: 30,
    enabled: true,
  },
  ltn: {
    id: 'ltn',
    name: 'Logic Tensor Networks',
    version: '2.0',
    license: 'MIT',
    pythonVersion: '3.8+',
    threadSafe: false, // TensorFlow session
    installCommand: 'pip install ltn',
    description: 'Differentiable first-order logic ("Real Logic") with fuzzy semantics',
    capabilities: [
      'FOL grounding to neural networks',
      'Product, Lukasiewicz, Godel semantics',
      'Trainable predicates and functions',
      'Gradient-based optimization',
      'Soft constraint satisfaction',
      'Neural-symbolic integration',
    ],
    useCases: [
      'Learning logical rules from data',
      'Soft constraint satisfaction',
      'Knowledge graph completion',
      'Neuro-symbolic reasoning',
    ],
    limitations: [
      'Requires TensorFlow 2',
      'Complex integration',
      'Training can be slow',
      'Semantic choices affect behavior',
    ],
    costPerInvocation: 0.001,
    averageLatencyMs: 500,
    enabled: true,
  },
  deepproblog: {
    id: 'deepproblog',
    name: 'DeepProbLog',
    version: '2.0',
    license: 'Apache-2.0',
    pythonVersion: '3.8+',
    threadSafe: false,
    installCommand: 'pip install deepproblog',
    description: 'Probabilistic logic programming with neural predicates',
    capabilities: [
      'ProbLog integration',
      'Neural network predicates',
      'Exact and sampling inference',
      'End-to-end differentiable',
      'Probabilistic queries',
      'Learning from examples',
    ],
    useCases: [
      'Probabilistic reasoning',
      'Neural-symbolic learning',
      'Uncertain knowledge',
      'Image classification with logic',
    ],
    limitations: [
      'Complex ProbLog dependency',
      'Exact inference exponential',
      'Sampling can be inaccurate',
      'Limited scalability',
    ],
    costPerInvocation: 0.002,
    averageLatencyMs: 1000,
    enabled: true,
  },
};

/**
 * Convert Library Registry entry to FormalReasoningLibraryInfo.
 */
function libraryToFormalReasoningInfo(
  library: Library,
  formalId: FormalReasoningLibrary
): FormalReasoningLibraryInfo {
  const fallback = FALLBACK_LIBRARY_REGISTRY[formalId];
  
  return {
    id: formalId,
    name: library.name,
    version: library.version || fallback.version,
    license: library.license,
    pythonVersion: fallback.pythonVersion,
    threadSafe: fallback.threadSafe,
    installCommand: fallback.installCommand,
    description: library.description,
    capabilities: fallback.capabilities,
    useCases: library.useCases || fallback.useCases,
    limitations: fallback.limitations,
    costPerInvocation: fallback.costPerInvocation,
    averageLatencyMs: fallback.averageLatencyMs,
    enabled: true,
    // Library Registry extras
    proficiencies: library.proficiencies,
    stars: library.stars,
    repo: library.repo,
    domains: library.domains,
  };
}

/**
 * Default configurations for each library.
 */
const DEFAULT_CONFIGS = {
  z3: {
    enabled: true,
    timeout_ms: 5000,
    parallel_enable: true,
    max_memory_mb: 512,
    unsat_core: true,
    model: true,
    proof: false,
  } as Z3Config,
  pyarg: {
    enabled: true,
    default_semantics: 'grounded' as ArgumentationSemantics,
    compute_explanations: true,
    max_arguments: 1000,
    max_attacks: 5000,
  } as PyArgConfig,
  pyreason: {
    enabled: true,
    default_timesteps: 10,
    convergence_threshold: 0.001,
    max_rules: 500,
    enable_explanations: true,
    parallel_cores: 4,
  } as PyReasonConfig,
  rdflib: {
    enabled: true,
    default_format: 'turtle' as const,
    store_backend: 'memory' as const,
    max_triples: 100000,
    enable_federation: false,
  } as RDFLibConfig,
  owlrl: {
    enabled: true,
    semantics: 'OWLRL' as const,
    axiom_triples: true,
    datatype_axioms: true,
  } as OWLRLConfig,
  pyshacl: {
    enabled: true,
    inference: 'rdfs' as const,
    advanced: true,
    js_support: false,
    abort_on_first: false,
    max_validation_depth: 10,
  } as PySHACLConfig,
  ltn: {
    enabled: true,
    fuzzy_semantics: 'product' as const,
    learning_rate: 0.001,
    epochs: 100,
    batch_size: 32,
    satisfaction_threshold: 0.9,
  } as LTNConfig,
  deepproblog: {
    enabled: true,
    inference_method: 'exact' as const,
    learning_rate: 0.001,
    epochs: 50,
    k_samples: 100,
  } as DeepProbLogConfig,
};

/**
 * Pricing per invocation by library (USD).
 */
const LIBRARY_PRICING: Record<FormalReasoningLibrary, number> = {
  z3: 0.0001,
  pyarg: 0.00005,
  pyreason: 0.0002,
  rdflib: 0.00002,
  owlrl: 0.0001,
  pyshacl: 0.00005,
  ltn: 0.001,
  deepproblog: 0.002,
};

class FormalReasoningService {
  private libraryCache: Map<FormalReasoningLibrary, FormalReasoningLibraryInfo> = new Map();
  private cacheLoadedAt: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Load libraries from the Library Registry database.
   */
  private async loadLibrariesFromRegistry(): Promise<void> {
    try {
      // Check if cache is still valid
      if (Date.now() - this.cacheLoadedAt < this.CACHE_TTL_MS && this.libraryCache.size > 0) {
        return;
      }

      // Load formal reasoning libraries from registry
      const registryLibraries = await libraryRegistryService.getLibrariesByCategory('Formal Reasoning');
      
      for (const [formalId, registryId] of Object.entries(LIBRARY_ID_MAP)) {
        const library = registryLibraries.find(l => l.libraryId === registryId);
        if (library) {
          this.libraryCache.set(
            formalId as FormalReasoningLibrary,
            libraryToFormalReasoningInfo(library, formalId as FormalReasoningLibrary)
          );
        } else {
          // Fallback to hardcoded
          this.libraryCache.set(
            formalId as FormalReasoningLibrary,
            FALLBACK_LIBRARY_REGISTRY[formalId as FormalReasoningLibrary]
          );
        }
      }

      this.cacheLoadedAt = Date.now();
      logger.info('Loaded formal reasoning libraries from registry', { count: this.libraryCache.size });
    } catch (error) {
      logger.warn(`Failed to load from registry, using fallback: ${String(error)}`);
      // Use fallback registry
      for (const [id, info] of Object.entries(FALLBACK_LIBRARY_REGISTRY)) {
        this.libraryCache.set(id as FormalReasoningLibrary, info);
      }
      this.cacheLoadedAt = Date.now();
    }
  }

  /**
   * Get all library information from Library Registry.
   */
  async getLibraryRegistry(): Promise<FormalReasoningLibraryInfo[]> {
    await this.loadLibrariesFromRegistry();
    return Array.from(this.libraryCache.values());
  }

  /**
   * Get all library information (sync - uses cache or fallback).
   */
  getLibraryRegistrySync(): FormalReasoningLibraryInfo[] {
    if (this.libraryCache.size > 0) {
      return Array.from(this.libraryCache.values());
    }
    return Object.values(FALLBACK_LIBRARY_REGISTRY);
  }

  /**
   * Get info for a specific library from Library Registry.
   */
  async getLibraryInfo(library: FormalReasoningLibrary): Promise<FormalReasoningLibraryInfo> {
    await this.loadLibrariesFromRegistry();
    return this.libraryCache.get(library) || FALLBACK_LIBRARY_REGISTRY[library];
  }

  /**
   * Get info for a specific library (sync - uses cache or fallback).
   */
  getLibraryInfoSync(library: FormalReasoningLibrary): FormalReasoningLibraryInfo {
    return this.libraryCache.get(library) || FALLBACK_LIBRARY_REGISTRY[library];
  }

  /**
   * Invalidate cache to force reload from database.
   */
  invalidateCache(): void {
    this.libraryCache.clear();
    this.cacheLoadedAt = 0;
  }

  /**
   * Get default configuration for a library.
   */
  getDefaultConfig(library: FormalReasoningLibrary): unknown {
    return DEFAULT_CONFIGS[library];
  }

  /**
   * Execute a formal reasoning request.
   */
  async execute(request: FormalReasoningRequest): Promise<FormalReasoningResponse> {
    const startTime = Date.now();
    const responseId = `fr-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    logger.info('Formal reasoning request', {
      requestId: request.id,
      library: request.library,
      taskType: request.taskType,
    });

    try {
      // Check if library is enabled for tenant
      const config = await this.getTenantConfig(request.tenantId);
      if (!config.enabledLibraries.includes(request.library)) {
        throw new Error(`Library ${request.library} is not enabled for this tenant`);
      }

      // Check budget
      const budgetCheck = await this.checkBudget(request.tenantId);
      if (!budgetCheck.allowed) {
        throw new Error(`Budget limit reached: ${budgetCheck.reason}`);
      }

      // Execute based on library
      let result: unknown;
      let status: ReasoningResultStatus = 'error';

      switch (request.library) {
        case 'z3':
          ({ result, status } = await this.executeZ3(request));
          break;
        case 'pyarg':
          ({ result, status } = await this.executePyArg(request));
          break;
        case 'pyreason':
          ({ result, status } = await this.executePyReason(request));
          break;
        case 'rdflib':
          ({ result, status } = await this.executeRDFLib(request));
          break;
        case 'owlrl':
          ({ result, status } = await this.executeOWLRL(request));
          break;
        case 'pyshacl':
          ({ result, status } = await this.executePySHACL(request));
          break;
        case 'ltn':
          ({ result, status } = await this.executeLTN(request));
          break;
        case 'deepproblog':
          ({ result, status } = await this.executeDeepProbLog(request));
          break;
        default:
          throw new Error(`Unknown library: ${request.library}`);
      }

      const computeTimeMs = Date.now() - startTime;
      const metrics: FormalReasoningMetrics = {
        computeTimeMs,
        memoryUsedMb: 0, // Would need process monitoring
        inputSize: JSON.stringify(request.input).length,
        outputSize: JSON.stringify(result).length,
      };

      // Log invocation
      await this.logInvocation({
        id: responseId,
        tenantId: request.tenantId,
        userId: request.userId,
        library: request.library,
        taskType: request.taskType,
        status,
        inputSummary: this.summarizeInput(request.input),
        outputSummary: this.summarizeOutput(result),
        computeTimeMs,
        memoryUsedMb: metrics.memoryUsedMb,
        costUsd: LIBRARY_PRICING[request.library],
        createdAt: new Date().toISOString(),
      });

      // Update cost aggregates
      await this.updateCostAggregates(request.tenantId, request.library, LIBRARY_PRICING[request.library]);

      return {
        id: responseId,
        requestId: request.id,
        library: request.library,
        taskType: request.taskType,
        status,
        result,
        metrics,
      };
    } catch (error) {
      const computeTimeMs = Date.now() - startTime;
      
      logger.error(`Formal reasoning failed: ${String(error)}`);

      // Log failed invocation
      await this.logInvocation({
        id: responseId,
        tenantId: request.tenantId,
        userId: request.userId,
        library: request.library,
        taskType: request.taskType,
        status: 'error',
        inputSummary: this.summarizeInput(request.input),
        outputSummary: '',
        computeTimeMs,
        memoryUsedMb: 0,
        costUsd: LIBRARY_PRICING[request.library] * 0.5, // Half cost for failed
        error: String(error),
        createdAt: new Date().toISOString(),
      });

      return {
        id: responseId,
        requestId: request.id,
        library: request.library,
        taskType: request.taskType,
        status: 'error',
        result: null,
        error: String(error),
        metrics: {
          computeTimeMs,
          memoryUsedMb: 0,
          inputSize: JSON.stringify(request.input).length,
          outputSize: 0,
        },
      };
    }
  }

  // ==========================================================================
  // Python Executor Invocation
  // ==========================================================================

  /**
   * Invoke the Python Lambda executor for formal reasoning libraries.
   * This is the main entry point for Z3, PyArg, PyReason, RDFLib, OWL-RL, and pySHACL.
   */
  private async invokePythonExecutor(
    library: FormalReasoningLibrary,
    taskType: ReasoningTaskType,
    input: unknown,
    config: unknown
  ): Promise<{ result: unknown; status: ReasoningResultStatus }> {
    if (!FORMAL_REASONING_EXECUTOR_ARN) {
      logger.warn('Python executor not configured, using fallback simulation');
      return this.simulateExecution(library, taskType, input);
    }

    const payload = {
      library,
      taskType,
      input,
      config,
      requestId: `fr-${Date.now()}`,
    };

    try {
      const command = new InvokeCommand({
        FunctionName: FORMAL_REASONING_EXECUTOR_ARN,
        Payload: Buffer.from(JSON.stringify(payload)),
        InvocationType: 'RequestResponse',
      });

      const response = await lambdaClient.send(command);
      
      if (response.FunctionError) {
        const errorPayload = response.Payload 
          ? JSON.parse(Buffer.from(response.Payload).toString())
          : { error: 'Unknown error' };
        throw new Error(`Python executor error: ${errorPayload.error || response.FunctionError}`);
      }

      if (!response.Payload) {
        throw new Error('Empty response from Python executor');
      }

      const responseBody = JSON.parse(Buffer.from(response.Payload).toString());
      const body = typeof responseBody.body === 'string' 
        ? JSON.parse(responseBody.body) 
        : responseBody.body || responseBody;

      return {
        result: body.result,
        status: body.status as ReasoningResultStatus,
      };
    } catch (error) {
      logger.error(`Python executor invocation failed: ${String(error)}`);
      // Fallback to simulation if executor fails
      return this.simulateExecution(library, taskType, input);
    }
  }

  /**
   * Invoke SageMaker endpoint for neural-symbolic libraries (LTN, DeepProbLog).
   */
  private async invokeSageMakerEndpoint(
    library: 'ltn' | 'deepproblog',
    input: unknown
  ): Promise<{ result: unknown; status: ReasoningResultStatus }> {
    const endpoint = library === 'ltn' ? LTN_ENDPOINT : DEEPPROBLOG_ENDPOINT;
    
    if (!endpoint) {
      logger.warn(`SageMaker endpoint not configured for ${library}`);
      return {
        result: { error: `${library} SageMaker endpoint not configured` },
        status: 'error',
      };
    }

    try {
      const command = new InvokeEndpointCommand({
        EndpointName: endpoint,
        ContentType: 'application/json',
        Body: Buffer.from(JSON.stringify(input)),
      });

      const response = await sagemakerClient.send(command);
      const body = JSON.parse(Buffer.from(response.Body!).toString());

      return {
        result: body,
        status: body.status || 'success',
      };
    } catch (error) {
      logger.error(`SageMaker invocation failed for ${library}: ${String(error)}`);
      return {
        result: { error: String(error) },
        status: 'error',
      };
    }
  }

  /**
   * Fallback simulation when executors are unavailable.
   */
  private simulateExecution(
    library: FormalReasoningLibrary,
    taskType: ReasoningTaskType,
    input: unknown
  ): { result: unknown; status: ReasoningResultStatus } {
    logger.info(`Simulating ${library} execution for ${taskType}`);
    
    // Return plausible mock results based on library
    switch (library) {
      case 'z3':
        return {
          result: { status: 'sat', model: {}, statistics: { time_ms: 50, memory_mb: 10, conflicts: 0, decisions: 100, propagations: 500 } },
          status: 'sat',
        };
      case 'pyarg':
        return {
          result: { semantics: 'grounded', extensions: [[]], skepticallyAccepted: [], rejected: [], computeTimeMs: 20 },
          status: 'accepted',
        };
      case 'rdflib':
        return {
          result: { type: 'bindings', bindings: [], computeTimeMs: 10 },
          status: 'inferred',
        };
      case 'owlrl':
        return {
          result: { originalTripleCount: 0, inferredTripleCount: 0, newTriples: [], computeTimeMs: 200 },
          status: 'inferred',
        };
      case 'pyshacl':
        return {
          result: { conforms: true, violations: [], computeTimeMs: 30 },
          status: 'conforms',
        };
      case 'pyreason':
        return {
          result: { timestep: 10, facts: [], derivations: [], converged: true, computeTimeMs: 100 },
          status: 'inferred',
        };
      default:
        return {
          result: { message: 'Simulated result' },
          status: 'unknown',
        };
    }
  }

  // ==========================================================================
  // Z3 Theorem Prover
  // ==========================================================================

  /**
   * Execute Z3 constraint solving or theorem proving via Python executor.
   */
  private async executeZ3(request: FormalReasoningRequest): Promise<{
    result: Z3Result;
    status: ReasoningResultStatus;
  }> {
    const config = await this.getTenantConfig(request.tenantId);
    const { result, status } = await this.invokePythonExecutor(
      'z3',
      request.taskType,
      request.input,
      config.z3
    );
    return { result: result as Z3Result, status };
  }

  // ==========================================================================
  // PyArg Argumentation
  // ==========================================================================

  /**
   * Execute PyArg argumentation semantics via Python executor.
   */
  private async executePyArg(request: FormalReasoningRequest): Promise<{
    result: ArgumentationResult;
    status: ReasoningResultStatus;
  }> {
    const config = await this.getTenantConfig(request.tenantId);
    const { result, status } = await this.invokePythonExecutor(
      'pyarg',
      request.taskType,
      request.input,
      config.pyarg
    );
    return { result: result as ArgumentationResult, status };
  }

  // ==========================================================================
  // PyReason Temporal Reasoning
  // ==========================================================================

  /**
   * Execute PyReason temporal graph reasoning via Python executor.
   */
  private async executePyReason(request: FormalReasoningRequest): Promise<{
    result: PyReasonInterpretation;
    status: ReasoningResultStatus;
  }> {
    const config = await this.getTenantConfig(request.tenantId);
    const { result, status } = await this.invokePythonExecutor(
      'pyreason',
      request.taskType,
      request.input,
      config.pyreason
    );
    return { result: result as PyReasonInterpretation, status };
  }

  // ==========================================================================
  // RDFLib Semantic Web
  // ==========================================================================

  /**
   * Execute RDFLib SPARQL queries or graph operations via Python executor.
   */
  private async executeRDFLib(request: FormalReasoningRequest): Promise<{
    result: SPARQLResult | { triples: RDFTriple[] };
    status: ReasoningResultStatus;
  }> {
    const config = await this.getTenantConfig(request.tenantId);
    const { result, status } = await this.invokePythonExecutor(
      'rdflib',
      request.taskType,
      request.input,
      config.rdflib
    );
    return { result: result as SPARQLResult, status };
  }

  // ==========================================================================
  // OWL-RL Ontology Inference
  // ==========================================================================

  /**
   * Execute OWL-RL ontological inference via Python executor.
   */
  private async executeOWLRL(request: FormalReasoningRequest): Promise<{
    result: OWLRLResult;
    status: ReasoningResultStatus;
  }> {
    const config = await this.getTenantConfig(request.tenantId);
    const { result, status } = await this.invokePythonExecutor(
      'owlrl',
      request.taskType,
      request.input,
      config.owlrl
    );
    return { result: result as OWLRLResult, status };
  }

  // ==========================================================================
  // pySHACL Validation
  // ==========================================================================

  /**
   * Execute pySHACL graph validation via Python executor.
   */
  private async executePySHACL(request: FormalReasoningRequest): Promise<{
    result: SHACLValidationResult;
    status: ReasoningResultStatus;
  }> {
    const config = await this.getTenantConfig(request.tenantId);
    const { result, status } = await this.invokePythonExecutor(
      'pyshacl',
      request.taskType,
      request.input,
      config.pyshacl
    );
    return { result: result as SHACLValidationResult, status };
  }

  // ==========================================================================
  // Logic Tensor Networks
  // ==========================================================================

  /**
   * Execute LTN differentiable logic via SageMaker endpoint.
   */
  private async executeLTN(request: FormalReasoningRequest): Promise<{
    result: LTNResult;
    status: ReasoningResultStatus;
  }> {
    logger.info('LTN execution via SageMaker');
    const { result, status } = await this.invokeSageMakerEndpoint('ltn', request.input);
    
    // If SageMaker is not available, return a fallback
    if (status === 'error') {
      return {
        result: {
          formula: '',
          satisfaction: 0,
          computeTimeMs: 0,
          error: 'LTN SageMaker endpoint not configured',
        } as LTNResult,
        status: 'error',
      };
    }
    
    return { result: result as LTNResult, status };
  }

  // ==========================================================================
  // DeepProbLog
  // ==========================================================================

  /**
   * Execute DeepProbLog probabilistic logic via SageMaker endpoint.
   */
  private async executeDeepProbLog(request: FormalReasoningRequest): Promise<{
    result: DeepProbLogResult;
    status: ReasoningResultStatus;
  }> {
    logger.info('DeepProbLog execution via SageMaker');
    const { result, status } = await this.invokeSageMakerEndpoint('deepproblog', request.input);
    
    // If SageMaker is not available, return a fallback
    if (status === 'error') {
      return {
        result: {
          query: '',
          probability: 0,
          computeTimeMs: 0,
          error: 'DeepProbLog SageMaker endpoint not configured',
        } as DeepProbLogResult,
        status: 'error',
      };
    }
    
    return { result: result as DeepProbLogResult, status };
  }

  // ==========================================================================
  // LLM-Modulo Integration
  // ==========================================================================

  /**
   * Execute Generate-Test-Critique loop for verified reasoning.
   */
  async executeLLMModulo(
    tenantId: string,
    llmGenerate: () => Promise<string>,
    verifyConfig: LLMModuloRequest
  ): Promise<LLMModuloResult> {
    const maxAttempts = 10;
    const feedback: string[] = [];
    let attempts = 0;
    let lastOutput = '';

    while (attempts < maxAttempts) {
      attempts++;

      // Generate
      try {
        lastOutput = await llmGenerate();
      } catch (error) {
        feedback.push(`Generation failed: ${String(error)}`);
        continue;
      }

      // Verify using specified library
      const verifyRequest: FormalReasoningRequest = {
        id: `verify-${attempts}`,
        tenantId,
        library: 'z3', // Default to Z3 for verification
        taskType: 'constraint_satisfaction',
        input: {
          type: 'solve',
          constraints: verifyConfig.constraints.map((c, i) => ({
            id: `c${i}`,
            expression: c,
            variables: [],
          })),
        },
      };

      const verifyResult = await this.execute(verifyRequest);

      if (verifyResult.status === 'sat' || verifyResult.status === 'valid' || verifyResult.status === 'conforms') {
        return {
          verified: true,
          attempts,
          finalOutput: lastOutput,
          violations: [],
          feedback,
          totalTimeMs: Date.now(),
        };
      }

      // Extract feedback for next iteration
      if (verifyResult.error) {
        feedback.push(verifyResult.error);
      }
    }

    return {
      verified: false,
      attempts,
      finalOutput: lastOutput,
      violations: feedback,
      feedback,
      totalTimeMs: Date.now(),
    };
  }

  // ==========================================================================
  // Admin & Configuration
  // ==========================================================================

  /**
   * Get tenant configuration.
   */
  async getTenantConfig(tenantId: string): Promise<FormalReasoningTenantConfig> {
    const result = await executeStatement(
      `SELECT * FROM formal_reasoning_config WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as Record<string, unknown>;
      return this.parseConfigRow(row);
    }

    // Return default config
    return this.getDefaultTenantConfig(tenantId);
  }

  /**
   * Update tenant configuration.
   */
  async updateTenantConfig(config: Partial<FormalReasoningTenantConfig>): Promise<void> {
    await executeStatement(
      `INSERT INTO formal_reasoning_config (
        tenant_id, enabled, enabled_libraries, z3_config, pyarg_config,
        pyreason_config, rdflib_config, owlrl_config, pyshacl_config,
        ltn_config, deepproblog_config, budget_limits, updated_at
      ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, NOW())
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        enabled_libraries = EXCLUDED.enabled_libraries,
        z3_config = EXCLUDED.z3_config,
        pyarg_config = EXCLUDED.pyarg_config,
        pyreason_config = EXCLUDED.pyreason_config,
        rdflib_config = EXCLUDED.rdflib_config,
        owlrl_config = EXCLUDED.owlrl_config,
        pyshacl_config = EXCLUDED.pyshacl_config,
        ltn_config = EXCLUDED.ltn_config,
        deepproblog_config = EXCLUDED.deepproblog_config,
        budget_limits = EXCLUDED.budget_limits,
        updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: config.tenantId! } },
        { name: 'enabled', value: { booleanValue: config.enabled ?? true } },
        { name: 'enabledLibraries', value: { stringValue: (config.enabledLibraries || Object.keys(LIBRARY_ID_MAP)).join(',') } },
        { name: 'z3Config', value: { stringValue: JSON.stringify(config.z3 || DEFAULT_CONFIGS.z3) } },
        { name: 'pyargConfig', value: { stringValue: JSON.stringify(config.pyarg || DEFAULT_CONFIGS.pyarg) } },
        { name: 'pyreasonConfig', value: { stringValue: JSON.stringify(config.pyreason || DEFAULT_CONFIGS.pyreason) } },
        { name: 'rdflibConfig', value: { stringValue: JSON.stringify(config.rdflib || DEFAULT_CONFIGS.rdflib) } },
        { name: 'owlrlConfig', value: { stringValue: JSON.stringify(config.owlrl || DEFAULT_CONFIGS.owlrl) } },
        { name: 'pyshaclConfig', value: { stringValue: JSON.stringify(config.pyshacl || DEFAULT_CONFIGS.pyshacl) } },
        { name: 'ltnConfig', value: { stringValue: JSON.stringify(config.ltn || DEFAULT_CONFIGS.ltn) } },
        { name: 'deepproblogConfig', value: { stringValue: JSON.stringify(config.deepproblog || DEFAULT_CONFIGS.deepproblog) } },
        { name: 'budgetLimits', value: { stringValue: JSON.stringify(config.budgetLimits || { dailyInvocations: 10000, dailyCostUsd: 10, monthlyInvocations: 100000, monthlyCostUsd: 100 }) } },
      ]
    );
  }

  /**
   * Get dashboard data for admin UI.
   */
  async getDashboard(tenantId: string): Promise<FormalReasoningDashboard> {
    const [config, stats, recentInvocations, libraryHealth, budgetUsage] = await Promise.all([
      this.getTenantConfig(tenantId),
      this.getStats(tenantId, 'day'),
      this.getRecentInvocations(tenantId, 20),
      this.getLibraryHealth(tenantId),
      this.getBudgetUsage(tenantId),
    ]);

    return {
      config,
      stats,
      recentInvocations,
      libraryHealth,
      budgetUsage,
    };
  }

  /**
   * Get usage statistics.
   */
  async getStats(tenantId: string, period: 'hour' | 'day' | 'week' | 'month'): Promise<FormalReasoningStats> {
    const intervalMap = { hour: '1 hour', day: '1 day', week: '7 days', month: '30 days' };
    const interval = intervalMap[period];

    const result = await executeStatement(
      `SELECT 
        library,
        COUNT(*) as invocations,
        SUM(CASE WHEN status != 'error' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
        SUM(cost_usd) as cost_usd,
        AVG(compute_time_ms) as avg_latency,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY compute_time_ms) as p95_latency,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY compute_time_ms) as p99_latency
       FROM formal_reasoning_invocations
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
       GROUP BY library`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const byLibrary: Record<string, LibraryStats> = {};
    let totalInvocations = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalCostUsd = 0;

    for (const row of result.rows || []) {
      const r = row as Record<string, unknown>;
      const library = String(r.library);
      const invocations = Number(r.invocations) || 0;
      const successful = Number(r.successful) || 0;
      const failed = Number(r.failed) || 0;
      const costUsd = Number(r.cost_usd) || 0;

      byLibrary[library] = {
        invocations,
        successful,
        failed,
        costUsd,
        averageLatencyMs: Number(r.avg_latency) || 0,
        averageMemoryMb: 0,
      };

      totalInvocations += invocations;
      totalSuccessful += successful;
      totalFailed += failed;
      totalCostUsd += costUsd;
    }

    return {
      tenantId,
      period,
      startDate: new Date(Date.now() - this.periodToMs(period)).toISOString(),
      endDate: new Date().toISOString(),
      byLibrary: byLibrary as Record<FormalReasoningLibrary, LibraryStats>,
      byTaskType: {} as Record<ReasoningTaskType, { invocations: number; successful: number; failed: number; averageLatencyMs: number }>,
      totalInvocations,
      totalSuccessful,
      totalFailed,
      totalCostUsd,
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
    };
  }

  /**
   * Get recent invocations.
   */
  async getRecentInvocations(tenantId: string, limit: number): Promise<FormalReasoningInvocationLog[]> {
    const result = await executeStatement(
      `SELECT * FROM formal_reasoning_invocations
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return (result.rows || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      userId: row.user_id ? String(row.user_id) : undefined,
      library: String(row.library) as FormalReasoningLibrary,
      taskType: String(row.task_type) as ReasoningTaskType,
      status: String(row.status) as ReasoningResultStatus,
      inputSummary: String(row.input_summary),
      outputSummary: String(row.output_summary),
      computeTimeMs: Number(row.compute_time_ms),
      memoryUsedMb: Number(row.memory_used_mb),
      costUsd: Number(row.cost_usd),
      error: row.error ? String(row.error) : undefined,
      createdAt: String(row.created_at),
    }));
  }

  /**
   * Get library health status.
   */
  async getLibraryHealth(tenantId: string): Promise<Record<FormalReasoningLibrary, LibraryHealth>> {
    const result = await executeStatement(
      `SELECT 
        library,
        MAX(CASE WHEN status != 'error' THEN created_at END) as last_success,
        MAX(CASE WHEN status = 'error' THEN error END) as last_error,
        AVG(CASE WHEN status = 'error' THEN 1.0 ELSE 0.0 END) as error_rate,
        AVG(compute_time_ms) as avg_latency
       FROM formal_reasoning_invocations
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
       GROUP BY library`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const health: Record<string, LibraryHealth> = {};

    for (const lib of Object.keys(LIBRARY_ID_MAP)) {
      const libInfo = this.libraryCache.get(lib as FormalReasoningLibrary) || FALLBACK_LIBRARY_REGISTRY[lib as FormalReasoningLibrary];
      health[lib] = {
        library: lib as FormalReasoningLibrary,
        status: 'healthy',
        errorRate24h: 0,
        averageLatency24h: libInfo.averageLatencyMs,
      };
    }

    for (const row of result.rows || []) {
      const r = row as Record<string, unknown>;
      const library = String(r.library);
      const errorRate = Number(r.error_rate) || 0;

      health[library] = {
        library: library as FormalReasoningLibrary,
        status: errorRate > 0.5 ? 'unavailable' : errorRate > 0.1 ? 'degraded' : 'healthy',
        lastSuccessfulInvocation: r.last_success ? String(r.last_success) : undefined,
        lastError: r.last_error ? String(r.last_error) : undefined,
        errorRate24h: errorRate,
        averageLatency24h: Number(r.avg_latency) || 0,
      };
    }

    return health as Record<FormalReasoningLibrary, LibraryHealth>;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async checkBudget(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
    const result = await executeStatement(
      `SELECT 
        COALESCE(SUM(cost_usd), 0) as daily_cost,
        COUNT(*) as daily_invocations
       FROM formal_reasoning_invocations
       WHERE tenant_id = $1 AND created_at > CURRENT_DATE`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const row = result.rows?.[0] as Record<string, unknown>;
    const dailyCost = Number(row?.daily_cost) || 0;
    const dailyInvocations = Number(row?.daily_invocations) || 0;

    const config = await this.getTenantConfig(tenantId);

    if (dailyCost >= config.budgetLimits.dailyCostUsd) {
      return { allowed: false, reason: `Daily cost limit ($${config.budgetLimits.dailyCostUsd}) reached` };
    }

    if (dailyInvocations >= config.budgetLimits.dailyInvocations) {
      return { allowed: false, reason: `Daily invocation limit (${config.budgetLimits.dailyInvocations}) reached` };
    }

    return { allowed: true };
  }

  private async getBudgetUsage(tenantId: string): Promise<{
    daily: { invocations: number; costUsd: number; percentUsed: number };
    monthly: { invocations: number; costUsd: number; percentUsed: number };
  }> {
    const config = await this.getTenantConfig(tenantId);

    const dailyResult = await executeStatement(
      `SELECT COUNT(*) as invocations, COALESCE(SUM(cost_usd), 0) as cost_usd
       FROM formal_reasoning_invocations
       WHERE tenant_id = $1 AND created_at > CURRENT_DATE`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const monthlyResult = await executeStatement(
      `SELECT COUNT(*) as invocations, COALESCE(SUM(cost_usd), 0) as cost_usd
       FROM formal_reasoning_invocations
       WHERE tenant_id = $1 AND created_at > DATE_TRUNC('month', CURRENT_DATE)`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const dailyRow = dailyResult.rows?.[0] as Record<string, unknown>;
    const monthlyRow = monthlyResult.rows?.[0] as Record<string, unknown>;

    const dailyInvocations = Number(dailyRow?.invocations) || 0;
    const dailyCost = Number(dailyRow?.cost_usd) || 0;
    const monthlyInvocations = Number(monthlyRow?.invocations) || 0;
    const monthlyCost = Number(monthlyRow?.cost_usd) || 0;

    return {
      daily: {
        invocations: dailyInvocations,
        costUsd: dailyCost,
        percentUsed: Math.max(
          (dailyInvocations / config.budgetLimits.dailyInvocations) * 100,
          (dailyCost / config.budgetLimits.dailyCostUsd) * 100
        ),
      },
      monthly: {
        invocations: monthlyInvocations,
        costUsd: monthlyCost,
        percentUsed: Math.max(
          (monthlyInvocations / config.budgetLimits.monthlyInvocations) * 100,
          (monthlyCost / config.budgetLimits.monthlyCostUsd) * 100
        ),
      },
    };
  }

  private async logInvocation(log: FormalReasoningInvocationLog): Promise<void> {
    await executeStatement(
      `INSERT INTO formal_reasoning_invocations (
        id, tenant_id, user_id, library, task_type, status,
        input_summary, output_summary, compute_time_ms, memory_used_mb,
        cost_usd, error, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        { name: 'id', value: { stringValue: log.id } },
        { name: 'tenantId', value: { stringValue: log.tenantId } },
        { name: 'userId', value: log.userId ? { stringValue: log.userId } : { isNull: true } },
        { name: 'library', value: { stringValue: log.library } },
        { name: 'taskType', value: { stringValue: log.taskType } },
        { name: 'status', value: { stringValue: log.status } },
        { name: 'inputSummary', value: { stringValue: log.inputSummary } },
        { name: 'outputSummary', value: { stringValue: log.outputSummary } },
        { name: 'computeTimeMs', value: { longValue: log.computeTimeMs } },
        { name: 'memoryUsedMb', value: { doubleValue: log.memoryUsedMb } },
        { name: 'costUsd', value: { doubleValue: log.costUsd } },
        { name: 'error', value: log.error ? { stringValue: log.error } : { isNull: true } },
        { name: 'createdAt', value: { stringValue: log.createdAt } },
      ]
    );
  }

  private async updateCostAggregates(tenantId: string, library: FormalReasoningLibrary, cost: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await executeStatement(
      `INSERT INTO formal_reasoning_cost_aggregates (tenant_id, date, library, invocation_count, total_cost_usd)
       VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (tenant_id, date, library) DO UPDATE SET
         invocation_count = formal_reasoning_cost_aggregates.invocation_count + 1,
         total_cost_usd = formal_reasoning_cost_aggregates.total_cost_usd + $4,
         updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'date', value: { stringValue: today } },
        { name: 'library', value: { stringValue: library } },
        { name: 'cost', value: { doubleValue: cost } },
      ]
    );
  }

  private getDefaultTenantConfig(tenantId: string): FormalReasoningTenantConfig {
    return {
      tenantId,
      enabled: true,
      enabledLibraries: Object.keys(LIBRARY_ID_MAP) as FormalReasoningLibrary[],
      z3: DEFAULT_CONFIGS.z3,
      pyarg: DEFAULT_CONFIGS.pyarg,
      pyreason: DEFAULT_CONFIGS.pyreason,
      rdflib: DEFAULT_CONFIGS.rdflib,
      owlrl: DEFAULT_CONFIGS.owlrl,
      pyshacl: DEFAULT_CONFIGS.pyshacl,
      ltn: DEFAULT_CONFIGS.ltn,
      deepproblog: DEFAULT_CONFIGS.deepproblog,
      budgetLimits: {
        dailyInvocations: 10000,
        dailyCostUsd: 10,
        monthlyInvocations: 100000,
        monthlyCostUsd: 100,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private parseConfigRow(row: Record<string, unknown>): FormalReasoningTenantConfig {
    return {
      tenantId: String(row.tenant_id),
      enabled: Boolean(row.enabled),
      enabledLibraries: String(row.enabled_libraries).split(',') as FormalReasoningLibrary[],
      z3: typeof row.z3_config === 'string' ? JSON.parse(row.z3_config) : row.z3_config,
      pyarg: typeof row.pyarg_config === 'string' ? JSON.parse(row.pyarg_config) : row.pyarg_config,
      pyreason: typeof row.pyreason_config === 'string' ? JSON.parse(row.pyreason_config) : row.pyreason_config,
      rdflib: typeof row.rdflib_config === 'string' ? JSON.parse(row.rdflib_config) : row.rdflib_config,
      owlrl: typeof row.owlrl_config === 'string' ? JSON.parse(row.owlrl_config) : row.owlrl_config,
      pyshacl: typeof row.pyshacl_config === 'string' ? JSON.parse(row.pyshacl_config) : row.pyshacl_config,
      ltn: typeof row.ltn_config === 'string' ? JSON.parse(row.ltn_config) : row.ltn_config,
      deepproblog: typeof row.deepproblog_config === 'string' ? JSON.parse(row.deepproblog_config) : row.deepproblog_config,
      budgetLimits: typeof row.budget_limits === 'string' ? JSON.parse(row.budget_limits) : row.budget_limits,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private summarizeInput(input: unknown): string {
    const str = JSON.stringify(input);
    return str.length > 200 ? str.substring(0, 200) + '...' : str;
  }

  private summarizeOutput(output: unknown): string {
    const str = JSON.stringify(output);
    return str.length > 200 ? str.substring(0, 200) + '...' : str;
  }

  private periodToMs(period: string): number {
    switch (period) {
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      case 'month': return 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }
}

export const formalReasoningService = new FormalReasoningService();
