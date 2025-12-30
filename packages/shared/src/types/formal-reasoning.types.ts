/**
 * Formal Reasoning Libraries Types
 * 
 * Type definitions for the 8 formal reasoning libraries integrated with the
 * consciousness service for verified reasoning, constraint satisfaction,
 * ontological inference, and structured argumentation.
 * 
 * Libraries:
 * 1. Z3 Theorem Prover - SMT solving, constraint verification
 * 2. PyArg - Structured argumentation semantics (Dung's AAF, ASPIC+)
 * 3. PyReason - Temporal graph reasoning with Generalized Annotated Logic
 * 4. RDFLib - Semantic web stack, SPARQL 1.1
 * 5. OWL-RL - Polynomial-time ontological inference
 * 6. pySHACL - Graph constraint validation
 * 7. Logic Tensor Networks - Differentiable first-order logic
 * 8. DeepProbLog - Probabilistic logic programming with neural predicates
 * 
 * @see https://github.com/Z3Prover/z3
 * @see https://github.com/DaphneOdekerken/PyArg
 * @see https://github.com/lab-v2/pyreason
 * @see https://github.com/RDFLib/rdflib
 * @see https://github.com/RDFLib/OWL-RL
 * @see https://github.com/RDFLib/pySHACL
 * @see https://github.com/logictensornetworks/logictensornetworks
 * @see https://github.com/ML-KULeuven/deepproblog
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Formal reasoning library identifiers.
 */
export type FormalReasoningLibrary =
  | 'z3'           // Z3 Theorem Prover - SMT solving
  | 'pyarg'        // PyArg - Argumentation frameworks
  | 'pyreason'     // PyReason - Temporal graph reasoning
  | 'rdflib'       // RDFLib - RDF/SPARQL
  | 'owlrl'        // OWL-RL - Ontological inference
  | 'pyshacl'      // pySHACL - SHACL validation
  | 'ltn'          // Logic Tensor Networks - Differentiable FOL
  | 'deepproblog'; // DeepProbLog - Probabilistic logic

/**
 * Library metadata including version, license, and capabilities.
 */
export interface FormalReasoningLibraryInfo {
  id: FormalReasoningLibrary;
  name: string;
  version: string;
  license: string;
  pythonVersion: string;
  threadSafe: boolean;
  installCommand: string;
  description: string;
  capabilities: string[];
  useCases: string[];
  limitations: string[];
  costPerInvocation: number; // USD estimate
  averageLatencyMs: number;
  enabled: boolean;
  // Library Registry integration fields
  proficiencies?: FormalReasoningProficiencies;
  stars?: number;
  repo?: string;
  domains?: string[];
  formalReasoning?: boolean;
  consciousnessIntegration?: boolean;
  neuralSymbolic?: boolean;
}

/**
 * Proficiency scores for formal reasoning libraries (8 dimensions, 1-10 scale).
 */
export interface FormalReasoningProficiencies {
  reasoning_depth: number;
  mathematical_quantitative: number;
  code_generation: number;
  creative_generative: number;
  research_synthesis: number;
  factual_recall_precision: number;
  multi_step_problem_solving: number;
  domain_terminology_handling: number;
}

/**
 * Reasoning task types that formal libraries can handle.
 */
export type ReasoningTaskType =
  | 'constraint_satisfaction'    // Z3: Solve constraints
  | 'theorem_proving'            // Z3: Prove logical statements
  | 'belief_verification'        // Z3: Verify belief consistency
  | 'argumentation'              // PyArg: Structured argumentation
  | 'belief_revision'            // PyArg: Update beliefs with new info
  | 'temporal_reasoning'         // PyReason: Time-based inference
  | 'graph_inference'            // PyReason: Knowledge graph reasoning
  | 'sparql_query'               // RDFLib: Query RDF graphs
  | 'knowledge_extraction'       // RDFLib: Extract triples from text
  | 'ontology_inference'         // OWL-RL: Deduce from ontology
  | 'schema_validation'          // pySHACL: Validate against shapes
  | 'differentiable_logic'       // LTN: Neural-symbolic reasoning
  | 'probabilistic_inference';   // DeepProbLog: Probabilistic logic

/**
 * Result status from formal reasoning operations.
 */
export type ReasoningResultStatus =
  | 'sat'           // Satisfiable (Z3)
  | 'unsat'         // Unsatisfiable (Z3)
  | 'unknown'       // Could not determine (Z3 timeout)
  | 'valid'         // Theorem is valid
  | 'invalid'       // Theorem is invalid
  | 'accepted'      // Argument accepted (PyArg)
  | 'rejected'      // Argument rejected (PyArg)
  | 'conforms'      // SHACL validation passed
  | 'violation'     // SHACL validation failed
  | 'inferred'      // New facts inferred
  | 'error';        // Processing error

// ============================================================================
// Z3 Theorem Prover Types
// ============================================================================

/**
 * Z3 solver configuration options.
 */
export interface Z3Config {
  enabled: boolean;
  timeout_ms: number;           // Max solving time
  parallel_enable: boolean;     // Enable parallel solving
  max_memory_mb: number;        // Memory limit
  unsat_core: boolean;          // Extract unsat cores
  model: boolean;               // Generate models for sat results
  proof: boolean;               // Generate proofs for unsat results
}

/**
 * Z3 constraint specification.
 */
export interface Z3Constraint {
  id: string;
  expression: string;           // SMT-LIB2 format or Python API
  variables: Z3Variable[];
  description?: string;
}

/**
 * Z3 variable declaration.
 */
export interface Z3Variable {
  name: string;
  type: 'Bool' | 'Int' | 'Real' | 'BitVec' | 'Array' | 'String' | 'Float';
  bitWidth?: number;            // For BitVec
  arrayIndexType?: string;      // For Array
  arrayValueType?: string;      // For Array
}

/**
 * Z3 solving result.
 */
export interface Z3Result {
  status: 'sat' | 'unsat' | 'unknown';
  model?: Record<string, unknown>;  // Variable assignments if sat
  unsatCore?: string[];             // Conflicting constraints if unsat
  proof?: string;                   // Proof if unsat and proof enabled
  statistics: {
    time_ms: number;
    memory_mb: number;
    conflicts: number;
    decisions: number;
    propagations: number;
  };
}

/**
 * Z3 theorem proving request.
 */
export interface Z3ProveRequest {
  theorem: string;              // Formula to prove
  axioms: string[];             // Background axioms
  timeout_ms?: number;
}

// ============================================================================
// PyArg Argumentation Types
// ============================================================================

/**
 * PyArg configuration for argumentation semantics.
 */
export interface PyArgConfig {
  enabled: boolean;
  default_semantics: ArgumentationSemantics;
  compute_explanations: boolean;
  max_arguments: number;
  max_attacks: number;
}

/**
 * Argumentation semantics supported by PyArg.
 */
export type ArgumentationSemantics =
  | 'admissible'
  | 'complete'
  | 'grounded'      // Most skeptical - always unique
  | 'preferred'     // Maximal admissible sets
  | 'stable'        // Attack all non-members
  | 'semi-stable'
  | 'ideal'
  | 'eager';

/**
 * Abstract Argumentation Framework (Dung's AAF).
 */
export interface ArgumentationFramework {
  id: string;
  arguments: Argument[];
  attacks: Attack[];
  metadata?: Record<string, unknown>;
}

/**
 * An argument in the framework.
 */
export interface Argument {
  id: string;
  claim: string;
  premises?: string[];
  source?: string;              // LLM, user, rule
  confidence?: number;          // 0-1
  timestamp?: string;
}

/**
 * An attack relation between arguments.
 */
export interface Attack {
  attacker: string;             // Argument ID
  target: string;               // Argument ID
  type?: 'rebut' | 'undercut' | 'undermine';
  strength?: number;            // 0-1 for weighted argumentation
}

/**
 * Result of argumentation semantics computation.
 */
export interface ArgumentationResult {
  semantics: ArgumentationSemantics;
  extensions: string[][];       // Sets of accepted argument IDs
  credulouslyAccepted: string[];
  skepticallyAccepted: string[];
  rejected: string[];
  explanations?: ArgumentExplanation[];
  computeTimeMs: number;
}

/**
 * Explanation for why an argument is accepted/rejected.
 */
export interface ArgumentExplanation {
  argumentId: string;
  status: 'accepted' | 'rejected' | 'undecided';
  reason: string;
  attackers?: string[];
  defenders?: string[];
}

// ============================================================================
// PyReason Temporal Reasoning Types
// ============================================================================

/**
 * PyReason configuration for temporal graph reasoning.
 */
export interface PyReasonConfig {
  enabled: boolean;
  default_timesteps: number;
  convergence_threshold: number;
  max_rules: number;
  enable_explanations: boolean;
  parallel_cores: number;
}

/**
 * PyReason rule definition.
 */
export interface PyReasonRule {
  id: string;
  name: string;
  head: string;                 // Conclusion
  body: string;                 // Conditions
  annotation?: [number, number]; // [lower, upper] bounds
  immediateRule?: boolean;
}

/**
 * PyReason fact with temporal annotation.
 */
export interface PyReasonFact {
  id: string;
  node: string;
  attribute: string;
  annotation: [number, number]; // [lower, upper] interval
  startTime: number;
  endTime: number;
}

/**
 * PyReason interpretation result.
 */
export interface PyReasonInterpretation {
  timestep: number;
  facts: PyReasonFact[];
  derivations: PyReasonDerivation[];
  converged: boolean;
  computeTimeMs: number;
}

/**
 * Explanation of how a fact was derived.
 */
export interface PyReasonDerivation {
  fact: PyReasonFact;
  rule: string;
  supportingFacts: string[];
  timestamp: number;
}

// ============================================================================
// RDFLib Semantic Web Types
// ============================================================================

/**
 * RDFLib configuration.
 */
export interface RDFLibConfig {
  enabled: boolean;
  default_format: RDFFormat;
  store_backend: 'memory' | 'berkeleydb' | 'sparqlstore';
  sparql_endpoint?: string;
  max_triples: number;
  enable_federation: boolean;
}

/**
 * RDF serialization formats.
 */
export type RDFFormat =
  | 'turtle'
  | 'xml'
  | 'n3'
  | 'ntriples'
  | 'nquads'
  | 'jsonld'
  | 'trig'
  | 'trix';

/**
 * RDF triple.
 */
export interface RDFTriple {
  subject: string;
  predicate: string;
  object: string;
  objectType?: 'uri' | 'literal' | 'bnode';
  datatype?: string;
  language?: string;
}

/**
 * SPARQL query request.
 */
export interface SPARQLQuery {
  query: string;
  type: 'SELECT' | 'CONSTRUCT' | 'ASK' | 'DESCRIBE' | 'UPDATE';
  bindings?: Record<string, string>;
  timeout_ms?: number;
}

/**
 * SPARQL query result.
 */
export interface SPARQLResult {
  type: 'bindings' | 'graph' | 'boolean';
  bindings?: Record<string, unknown>[];
  graph?: RDFTriple[];
  boolean?: boolean;
  computeTimeMs: number;
}

// ============================================================================
// OWL-RL Ontology Inference Types
// ============================================================================

/**
 * OWL-RL configuration.
 */
export interface OWLRLConfig {
  enabled: boolean;
  semantics: 'RDFS' | 'OWLRL' | 'RDFS_OWLRL';
  axiom_triples: boolean;
  datatype_axioms: boolean;
}

/**
 * OWL-RL inference result.
 */
export interface OWLRLResult {
  originalTripleCount: number;
  inferredTripleCount: number;
  newTriples: RDFTriple[];
  inconsistencies: OWLInconsistency[];
  computeTimeMs: number;
}

/**
 * Detected ontological inconsistency.
 */
export interface OWLInconsistency {
  type: 'nothing_instance' | 'property_violation' | 'class_conflict';
  description: string;
  affectedResources: string[];
}

// ============================================================================
// pySHACL Validation Types
// ============================================================================

/**
 * pySHACL configuration.
 */
export interface PySHACLConfig {
  enabled: boolean;
  inference: 'none' | 'rdfs' | 'owlrl' | 'both';
  advanced: boolean;            // Enable SHACL-AF
  js_support: boolean;          // Enable SHACL-JS
  abort_on_first: boolean;
  max_validation_depth: number;
}

/**
 * SHACL shape definition.
 */
export interface SHACLShape {
  id: string;
  targetClass?: string;
  targetNode?: string;
  targetSubjectsOf?: string;
  targetObjectsOf?: string;
  properties: SHACLPropertyShape[];
  closed?: boolean;
  ignoredProperties?: string[];
}

/**
 * SHACL property constraint.
 */
export interface SHACLPropertyShape {
  path: string;
  name?: string;
  description?: string;
  minCount?: number;
  maxCount?: number;
  datatype?: string;
  nodeKind?: 'IRI' | 'Literal' | 'BlankNode' | 'BlankNodeOrIRI' | 'BlankNodeOrLiteral' | 'IRIOrLiteral';
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minInclusive?: number;
  maxInclusive?: number;
  in?: string[];
  hasValue?: string;
  class?: string;
  node?: string;
}

/**
 * SHACL validation result.
 */
export interface SHACLValidationResult {
  conforms: boolean;
  violations: SHACLViolation[];
  warnings: SHACLViolation[];
  infos: SHACLViolation[];
  computeTimeMs: number;
}

/**
 * SHACL validation violation.
 */
export interface SHACLViolation {
  focusNode: string;
  resultPath?: string;
  value?: string;
  message: string;
  severity: 'Violation' | 'Warning' | 'Info';
  sourceShape: string;
  sourceConstraintComponent: string;
}

// ============================================================================
// Logic Tensor Networks Types
// ============================================================================

/**
 * LTN configuration.
 */
export interface LTNConfig {
  enabled: boolean;
  fuzzy_semantics: 'product' | 'lukasiewicz' | 'godel';
  learning_rate: number;
  epochs: number;
  batch_size: number;
  satisfaction_threshold: number;
}

/**
 * LTN grounding - mapping symbols to tensors.
 */
export interface LTNGrounding {
  constants: Record<string, number[]>;   // Name -> embedding
  predicates: Record<string, LTNPredicate>;
  functions: Record<string, LTNFunction>;
}

/**
 * LTN predicate (neural network).
 */
export interface LTNPredicate {
  name: string;
  arity: number;
  layers: number[];             // Hidden layer sizes
  activation: 'sigmoid' | 'tanh' | 'relu';
}

/**
 * LTN function (neural network).
 */
export interface LTNFunction {
  name: string;
  arity: number;
  outputDim: number;
  layers: number[];
}

/**
 * LTN formula for training/querying.
 */
export interface LTNFormula {
  id: string;
  expression: string;           // FOL syntax
  isAxiom: boolean;             // Must be satisfied
  weight?: number;              // Importance during training
}

/**
 * LTN query result.
 */
export interface LTNResult {
  formula: string;
  satisfaction: number;         // 0-1 truth value
  gradients?: Record<string, number[]>;
  computeTimeMs: number;
}

// ============================================================================
// DeepProbLog Types
// ============================================================================

/**
 * DeepProbLog configuration.
 */
export interface DeepProbLogConfig {
  enabled: boolean;
  inference_method: 'exact' | 'sampling' | 'geometric_mean';
  learning_rate: number;
  epochs: number;
  k_samples?: number;           // For sampling inference
}

/**
 * DeepProbLog neural predicate.
 */
export interface NeuralPredicate {
  name: string;
  network: string;              // Network identifier
  inputArity: number;
  outputDomain: string[];       // Possible output values
}

/**
 * DeepProbLog program.
 */
export interface DeepProbLogProgram {
  id: string;
  facts: string[];              // Probabilistic facts
  rules: string[];              // Logic rules
  neuralPredicates: NeuralPredicate[];
  queries: string[];
}

/**
 * DeepProbLog query result.
 */
export interface DeepProbLogResult {
  query: string;
  probability: number;
  proofs?: DeepProbLogProof[];
  computeTimeMs: number;
}

/**
 * Proof trace for a query.
 */
export interface DeepProbLogProof {
  steps: string[];
  probability: number;
  neuralContributions: Record<string, number>;
}

// ============================================================================
// Unified Reasoning Request/Response
// ============================================================================

/**
 * Unified formal reasoning request.
 */
export interface FormalReasoningRequest {
  id: string;
  tenantId: string;
  userId?: string;
  library: FormalReasoningLibrary;
  taskType: ReasoningTaskType;
  input: unknown;               // Library-specific input
  config?: Partial<LibraryConfig>;
  timeout_ms?: number;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Union of all library configs.
 */
export type LibraryConfig =
  | Z3Config
  | PyArgConfig
  | PyReasonConfig
  | RDFLibConfig
  | OWLRLConfig
  | PySHACLConfig
  | LTNConfig
  | DeepProbLogConfig;

/**
 * Unified formal reasoning response.
 */
export interface FormalReasoningResponse {
  id: string;
  requestId: string;
  library: FormalReasoningLibrary;
  taskType: ReasoningTaskType;
  status: ReasoningResultStatus;
  result: unknown;              // Library-specific result
  explanation?: string;
  metrics: FormalReasoningMetrics;
  error?: string;
}

/**
 * Metrics for a reasoning operation.
 */
export interface FormalReasoningMetrics {
  computeTimeMs: number;
  memoryUsedMb: number;
  inputSize: number;
  outputSize: number;
  iterations?: number;
  satisfactionScore?: number;
}

// ============================================================================
// Admin & Monitoring Types
// ============================================================================

/**
 * Per-tenant formal reasoning configuration.
 */
export interface FormalReasoningTenantConfig {
  tenantId: string;
  enabled: boolean;
  enabledLibraries: FormalReasoningLibrary[];
  z3: Z3Config;
  pyarg: PyArgConfig;
  pyreason: PyReasonConfig;
  rdflib: RDFLibConfig;
  owlrl: OWLRLConfig;
  pyshacl: PySHACLConfig;
  ltn: LTNConfig;
  deepproblog: DeepProbLogConfig;
  budgetLimits: {
    dailyInvocations: number;
    dailyCostUsd: number;
    monthlyInvocations: number;
    monthlyCostUsd: number;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Formal reasoning usage statistics.
 */
export interface FormalReasoningStats {
  tenantId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  startDate: string;
  endDate: string;
  byLibrary: Record<FormalReasoningLibrary, LibraryStats>;
  byTaskType: Record<ReasoningTaskType, TaskTypeStats>;
  totalInvocations: number;
  totalSuccessful: number;
  totalFailed: number;
  totalCostUsd: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

/**
 * Statistics for a specific library.
 */
export interface LibraryStats {
  invocations: number;
  successful: number;
  failed: number;
  costUsd: number;
  averageLatencyMs: number;
  averageMemoryMb: number;
}

/**
 * Statistics for a specific task type.
 */
export interface TaskTypeStats {
  invocations: number;
  successful: number;
  failed: number;
  averageLatencyMs: number;
}

/**
 * Dashboard data for admin UI.
 */
export interface FormalReasoningDashboard {
  config: FormalReasoningTenantConfig;
  stats: FormalReasoningStats;
  recentInvocations: FormalReasoningInvocationLog[];
  libraryHealth: Record<FormalReasoningLibrary, LibraryHealth>;
  budgetUsage: {
    daily: { invocations: number; costUsd: number; percentUsed: number };
    monthly: { invocations: number; costUsd: number; percentUsed: number };
  };
}

/**
 * Health status of a library.
 */
export interface LibraryHealth {
  library: FormalReasoningLibrary;
  status: 'healthy' | 'degraded' | 'unavailable';
  lastSuccessfulInvocation?: string;
  lastError?: string;
  errorRate24h: number;
  averageLatency24h: number;
}

/**
 * Invocation log entry.
 */
export interface FormalReasoningInvocationLog {
  id: string;
  tenantId: string;
  userId?: string;
  library: FormalReasoningLibrary;
  taskType: ReasoningTaskType;
  status: ReasoningResultStatus;
  inputSummary: string;
  outputSummary: string;
  computeTimeMs: number;
  memoryUsedMb: number;
  costUsd: number;
  error?: string;
  createdAt: string;
}

// ============================================================================
// LLM-Modulo Integration Types
// ============================================================================

/**
 * Generate-Test-Critique loop configuration.
 */
export interface LLMModuloConfig {
  enabled: boolean;
  maxAttempts: number;
  feedbackVerbosity: 'minimal' | 'detailed' | 'full';
  verifierLibrary: FormalReasoningLibrary;
  fallbackOnTimeout: boolean;
}

/**
 * LLM-Modulo verification request.
 */
export interface LLMModuloRequest {
  id: string;
  llmOutput: string;
  expectedFormat: 'smt2' | 'turtle' | 'sparql' | 'fol' | 'json';
  constraints: string[];
  verifierConfig: Partial<LibraryConfig>;
}

/**
 * LLM-Modulo verification result.
 */
export interface LLMModuloResult {
  verified: boolean;
  attempts: number;
  finalOutput?: string;
  violations: string[];
  feedback: string[];
  totalTimeMs: number;
}

// ============================================================================
// Global Workspace Theory Integration
// ============================================================================

/**
 * GWT workspace configuration for formal reasoning.
 */
export interface GWTWorkspaceConfig {
  enabled: boolean;
  modules: GWTModule[];
  attentionThreshold: number;
  broadcastCooldownMs: number;
  maxWorkspaceSize: number;
}

/**
 * A module in the Global Workspace.
 */
export interface GWTModule {
  id: string;
  name: string;
  type: 'perception' | 'reasoning' | 'memory' | 'action' | 'meta';
  library?: FormalReasoningLibrary;
  priority: number;
  enabled: boolean;
}

/**
 * Workspace broadcast event.
 */
export interface GWTBroadcast {
  id: string;
  sourceModule: string;
  content: unknown;
  salience: number;
  timestamp: string;
  recipients: string[];
}
