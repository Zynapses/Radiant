// Intelligence Aggregator Types
// Supports: MoA Synthesis, Cross-Provider Verification, Logprobs Uncertainty, Success Memory, Code Execution

// ============================================================================
// 1. LOGPROBS UNCERTAINTY DETECTION
// ============================================================================

export interface TokenLogprob {
  token: string;
  logprob: number;
  confidence: number; // exp(logprob), 0-1
  position: number;
}

export interface UncertaintyMetrics {
  avgLogprob: number;
  minLogprob: number;
  confidenceScore: number; // 0-1
  uncertainTokens: TokenLogprob[];
}

export interface UncertaintyEvent {
  id: string;
  tenantId: string;
  userId: string;
  planId?: string;
  modelId: string;
  provider: string;
  promptHash: string;
  metrics: UncertaintyMetrics;
  triggerThreshold: number;
  triggeredVerification: boolean;
  verificationTool?: 'web_search' | 'vector_db' | 'none';
  verificationResult?: Record<string, unknown>;
  uncertainClaim?: string;
  claimType?: 'factual' | 'numerical' | 'citation' | 'code';
  detectedAt: Date;
  resolvedAt?: Date;
}

export interface UncertaintyConfig {
  enabled: boolean;
  threshold: number; // Default 0.85
  verificationTool: 'web_search' | 'vector_db' | 'none';
  claimTypes: string[];
}

// ============================================================================
// 2. SUCCESS MEMORY RAG
// ============================================================================

export interface GoldInteraction {
  id: string;
  tenantId: string;
  userId: string;
  conversationId?: string;
  messageId?: string;
  promptText: string;
  promptEmbedding?: number[];
  promptTokens?: number;
  responseText: string;
  responseStructure?: ResponseStructure;
  responseTokens?: number;
  rating: number; // 4 or 5
  explicitFeedback?: string;
  implicitSignals?: ImplicitSignals;
  domainId?: string;
  orchestrationMode?: string;
  modelUsed?: string;
  taskType?: TaskType;
  timesRetrieved: number;
  lastRetrievedAt?: Date;
  retrievalSuccessRate?: number;
  createdAt: Date;
}

export interface ResponseStructure {
  format: 'prose' | 'list' | 'code' | 'mixed';
  sections?: string[];
  codeBlocks?: number;
  tone?: 'formal' | 'casual' | 'technical';
  length?: 'short' | 'medium' | 'long';
}

export interface ImplicitSignals {
  copied?: boolean;
  shared?: boolean;
  timeSpentReadingMs?: number;
  scrolledToEnd?: boolean;
  expandedCodeBlocks?: boolean;
}

export type TaskType = 'coding' | 'writing' | 'analysis' | 'research' | 'creative' | 'conversation';

export interface GoldInteractionMatch {
  interaction: GoldInteraction;
  similarity: number;
}

export interface SuccessMemoryConfig {
  enabled: boolean;
  minRatingForGold: number; // Default 4
  maxGoldInteractions: number; // Default 1000
  retrievalCount: number; // Default 3
  similarityThreshold: number; // Default 0.75
}

// ============================================================================
// 3. MIXTURE OF AGENTS (MoA) SYNTHESIS
// ============================================================================

export type SynthesisMode = 'standard' | 'deep' | 'consensus';
export type SynthesisStatus = 'pending' | 'proposing' | 'synthesizing' | 'completed' | 'failed';

export interface SynthesisSession {
  id: string;
  tenantId: string;
  userId: string;
  planId?: string;
  promptText: string;
  promptHash: string;
  synthesisMode: SynthesisMode;
  proposerModels: string[];
  proposerCount: number;
  synthesizerModel: string;
  status: SynthesisStatus;
  startedAt?: Date;
  proposersCompletedAt?: Date;
  synthesisCompletedAt?: Date;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostCents?: number;
  createdAt: Date;
}

export interface SynthesisDraft {
  id: string;
  sessionId: string;
  modelId: string;
  provider: string;
  draftOrder: number;
  responseText: string;
  responseTokens?: number;
  strengths?: string[];
  weaknesses?: string[];
  uniqueInsights?: string[];
  factualClaims?: FactualClaim[];
  latencyMs?: number;
  logprobAvg?: number;
  createdAt: Date;
}

export interface FactualClaim {
  claim: string;
  confidence: number;
  source?: string;
}

export interface SynthesisResult {
  id: string;
  sessionId: string;
  finalResponse: string;
  synthesisReasoning?: string;
  primarySourceDraftId?: string;
  contributionWeights: Record<string, number>;
  conflictsFound: number;
  conflictsResolved?: ConflictResolution[];
  coherenceScore?: number;
  factualConfidence?: number;
  createdAt: Date;
}

export interface ConflictResolution {
  claim: string;
  draftA: string;
  draftB: string;
  resolution: string;
  resolvedBy: 'synthesizer' | 'verification' | 'user';
}

export interface MoAConfig {
  enabled: boolean;
  proposerCount: number; // Default 3
  defaultProposers: string[]; // ['gpt-4o', 'claude-3-5-sonnet', 'deepseek-v3']
  synthesizerModel: string; // 'claude-3-5-sonnet'
  synthesisMode: SynthesisMode;
  maxCostCents?: number;
}

// ============================================================================
// 4. CROSS-PROVIDER VERIFICATION
// ============================================================================

export type VerificationStatus = 'pending' | 'pass' | 'issues_found' | 'regenerating';
export type AdversaryPersona = 'security_auditor' | 'fact_checker' | 'logic_analyzer' | 'code_reviewer';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueType = 'hallucination' | 'logic_gap' | 'security_vuln' | 'factual_error' | 'bias' | 'code_bug';

export interface VerificationSession {
  id: string;
  tenantId: string;
  userId: string;
  planId?: string;
  generatorModel: string;
  generatorProvider: string;
  generatorResponse: string;
  adversaryModel: string;
  adversaryProvider: string;
  adversaryPersona: AdversaryPersona;
  verificationStatus: VerificationStatus;
  issuesFound: VerificationIssue[];
  issueCount: number;
  regenerationCount: number;
  maxRegenerations: number;
  finalResponse?: string;
  startedAt: Date;
  adversaryCompletedAt?: Date;
  completedAt?: Date;
  totalTokens: number;
  createdAt: Date;
}

export interface VerificationIssue {
  id: string;
  sessionId: string;
  issueType: IssueType;
  severity: IssueSeverity;
  description: string;
  locationInResponse?: string;
  resolved: boolean;
  resolutionMethod?: 'regenerated' | 'patched' | 'acknowledged';
  createdAt: Date;
}

export interface VerificationConfig {
  enabled: boolean;
  modes: string[]; // Which orchestration modes trigger verification
  maxRegenerations: number; // Default 2
  severityThreshold: IssueSeverity; // Minimum severity to trigger regeneration
  providerDiversityRequired: boolean; // Enforce different provider for adversary
}

// Provider diversity mapping
export const ADVERSARY_PROVIDER_MAP: Record<string, string[]> = {
  openai: ['anthropic', 'google'],
  anthropic: ['openai', 'google'],
  google: ['openai', 'anthropic'],
  deepseek: ['openai', 'anthropic'],
  mistral: ['openai', 'anthropic'],
};

// ============================================================================
// 5. CODE EXECUTION SANDBOX
// ============================================================================

export type CodeLanguage = 'python' | 'javascript' | 'typescript';
export type ExecutionStatus = 'pending' | 'running' | 'passed' | 'failed' | 'patching' | 'timeout';
export type SandboxType = 'lambda' | 'fargate' | 'wasm';
export type ErrorType = 'syntax' | 'runtime' | 'timeout' | 'memory' | 'none';

export interface CodeExecutionSession {
  id: string;
  tenantId: string;
  userId: string;
  planId?: string;
  language: CodeLanguage;
  originalCode: string;
  currentCode: string;
  testInput?: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  status: ExecutionStatus;
  iterationCount: number;
  maxIterations: number;
  finalCode?: string;
  executionSuccess?: boolean;
  sandboxType: SandboxType;
  resourceLimits: ResourceLimits;
  startedAt?: Date;
  completedAt?: Date;
  totalExecutionTimeMs?: number;
  createdAt: Date;
}

export interface ResourceLimits {
  memoryMb: number; // Default 128
  timeoutSeconds: number; // Default 10
  cpuShares: number; // Default 256
}

export interface CodeExecutionRun {
  id: string;
  sessionId: string;
  runNumber: number;
  codeSnapshot: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  errorType: ErrorType;
  errorMessage?: string;
  errorLine?: number;
  patchPrompt?: string;
  patchApplied?: string;
  executionTimeMs?: number;
  createdAt: Date;
}

export interface CodeExecutionConfig {
  enabled: boolean;
  languages: CodeLanguage[];
  timeoutSeconds: number;
  memoryMb: number;
  maxIterations: number;
  sandboxType: SandboxType;
}

// ============================================================================
// AGGREGATOR CONFIG (Combined)
// ============================================================================

export interface IntelligenceAggregatorConfig {
  tenantId: string;
  uncertainty: UncertaintyConfig;
  successMemory: SuccessMemoryConfig;
  moa: MoAConfig;
  verification: VerificationConfig;
  codeExecution: CodeExecutionConfig;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_AGGREGATOR_CONFIG: Omit<IntelligenceAggregatorConfig, 'tenantId' | 'createdAt' | 'updatedAt'> = {
  uncertainty: {
    enabled: true,
    threshold: 0.85,
    verificationTool: 'web_search',
    claimTypes: ['factual', 'numerical', 'citation'],
  },
  successMemory: {
    enabled: true,
    minRatingForGold: 4,
    maxGoldInteractions: 1000,
    retrievalCount: 3,
    similarityThreshold: 0.75,
  },
  moa: {
    enabled: false, // Off by default (cost)
    proposerCount: 3,
    defaultProposers: ['gpt-4o', 'claude-3-5-sonnet', 'deepseek-v3'],
    synthesizerModel: 'claude-3-5-sonnet',
    synthesisMode: 'standard',
  },
  verification: {
    enabled: false, // Off by default (cost)
    modes: ['coding', 'research', 'analysis'],
    maxRegenerations: 2,
    severityThreshold: 'high',
    providerDiversityRequired: true,
  },
  codeExecution: {
    enabled: false, // Off by default (security)
    languages: ['python', 'javascript'],
    timeoutSeconds: 10,
    memoryMb: 128,
    maxIterations: 3,
    sandboxType: 'lambda',
  },
};
