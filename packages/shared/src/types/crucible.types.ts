/**
 * The Crucible - Competitive Multi-LLM Deliberation System
 * 
 * A novel orchestration primitive where multiple LLMs engage in competitive
 * cross-questioning to refine their answers before reporting to the method.
 * 
 * Key Features:
 * - Pre-prompt notification of evaluation criteria
 * - Iterative cross-questioning (up to 5 questions total by default)
 * - Competition-focused (not consensus)
 * - Provenance tracking to detect circular reasoning
 * - Full audit trail for learning and compliance
 * 
 * @version 1.0.0
 * @since v6.4.0
 */

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Crucible configuration for a tenant
 */
export interface CrucibleConfig {
  /** Tenant ID */
  tenantId: string;
  
  /** Enable The Crucible for multi-LLM methods */
  enabled: boolean;
  
  /** Default max questions per deliberation session */
  defaultMaxQuestions: number;
  
  /** Default timeout per question (seconds) */
  questionTimeoutSeconds: number;
  
  /** Total session timeout (seconds) */
  sessionTimeoutSeconds: number;
  
  /** Minimum LLMs required to trigger Crucible */
  minLlmsForCrucible: number;
  
  /** Store sessions for learning */
  storeForLearning: boolean;
  
  /** Retention period for stored sessions (days) */
  sessionRetentionDays: number;
  
  /** Enable circular reasoning detection */
  detectCircularReasoning: boolean;
  
  /** Penalty weight for circular citations (0-1) */
  circularCitationPenalty: number;
  
  /** Enable question quality scoring */
  scoreQuestionQuality: boolean;
  
  /** Cost mode affects question limits */
  costModeQuestionLimits: Record<CrucibleCostMode, number>;
  
  /** Created timestamp */
  createdAt: Date;
  
  /** Updated timestamp */
  updatedAt: Date;
}

export type CrucibleCostMode = 'economy' | 'balanced' | 'thorough';

export const DEFAULT_CRUCIBLE_CONFIG: Omit<CrucibleConfig, 'tenantId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  defaultMaxQuestions: 5,
  questionTimeoutSeconds: 30,
  sessionTimeoutSeconds: 180,
  minLlmsForCrucible: 2,
  storeForLearning: true,
  sessionRetentionDays: 90,
  detectCircularReasoning: true,
  circularCitationPenalty: 0.15,
  scoreQuestionQuality: true,
  costModeQuestionLimits: {
    economy: 3,
    balanced: 5,
    thorough: 8
  }
};

// =============================================================================
// Participant Types
// =============================================================================

/**
 * Model type classification for Crucible eligibility
 */
export type CrucibleModelType = 'llm' | 'vision' | 'audio' | 'embedding' | 'other';

/**
 * A participant in a Crucible session
 * Only LLMs can ask/answer questions; other models can contribute output but not deliberate
 */
export interface CrucibleParticipant {
  /** Unique participant ID within session */
  participantId: string;
  
  /** Model ID from registry */
  modelId: string;
  
  /** Model display name */
  modelName: string;
  
  /** Provider (anthropic, openai, bedrock, self-hosted, etc.) */
  provider: string;
  
  /** Model type */
  modelType: CrucibleModelType;
  
  /** Is this an LLM that can participate in deliberation? */
  canDeliberate: boolean;
  
  /** Model mode/specialty if applicable */
  modelMode?: string;
  
  /** Initial integrity score from LIVS */
  integrityScore?: number;
  
  /** Has this LLM been interrogated? */
  wasInterrogated: boolean;
  
  /** Questions remaining for this participant */
  questionsRemaining: number;
  
  /** Questions asked by this participant */
  questionsAsked: number;
  
  /** Questions received by this participant */
  questionsReceived: number;
  
  /** Current score adjustment from deliberation */
  scoreAdjustment: number;
  
  /** Circular citation count detected */
  circularCitations: number;
}

// =============================================================================
// Pre-Prompt Types
// =============================================================================

/**
 * Pre-prompt notification sent to all LLM participants
 */
export interface CruciblePrePrompt {
  /** Evaluation criteria weights */
  evaluationCriteria: CrucibleEvaluationCriteria;
  
  /** Participant roster (models they can question) */
  participantRoster: CrucibleParticipantInfo[];
  
  /** Competition rules */
  competitionRules: CrucibleCompetitionRules;
  
  /** The generated pre-prompt text */
  promptText: string;
}

export interface CrucibleEvaluationCriteria {
  /** Accuracy weight (0-1), primary factor */
  accuracyWeight: number;
  
  /** Truthfulness weight (0-1), important but secondary to accuracy */
  truthfulnessWeight: number;
  
  /** Reasoning quality weight (0-1) */
  reasoningWeight: number;
  
  /** Completeness weight (0-1) */
  completenessWeight: number;
  
  /** Citation quality weight (0-1) */
  citationWeight: number;
}

export const DEFAULT_EVALUATION_CRITERIA: CrucibleEvaluationCriteria = {
  accuracyWeight: 0.40,
  truthfulnessWeight: 0.25,
  reasoningWeight: 0.15,
  completenessWeight: 0.10,
  citationWeight: 0.10
};

export interface CrucibleParticipantInfo {
  /** Participant ID */
  participantId: string;
  
  /** Model name (visible to others) */
  modelName: string;
  
  /** Provider */
  provider: string;
  
  /** Model mode/specialty */
  modelMode?: string;
  
  /** Known strengths (from model registry) */
  strengths?: string[];
}

export interface CrucibleCompetitionRules {
  /** Maximum questions this LLM can ask total */
  maxQuestions: number;
  
  /** Questions can be asked iteratively (not all at once) */
  iterativeQuestioning: boolean;
  
  /** No penalty for asking questions */
  noPenaltyForQuestions: boolean;
  
  /** Goal is competition, not consensus */
  competitiveMode: true;
  
  /** Provenance must be tracked */
  trackProvenance: boolean;
  
  /** Circular citations will be detected and penalized */
  detectCircularCitations: boolean;
  
  /** Timeout per question (seconds) */
  questionTimeout: number;
}

// =============================================================================
// Session Types
// =============================================================================

export type CrucibleSessionStatus = 
  | 'initializing'
  | 'pre_prompting'
  | 'interrogating'
  | 'deliberating'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'timeout';

/**
 * A Crucible deliberation session
 */
export interface CrucibleSession {
  /** Unique session ID */
  sessionId: string;
  
  /** Tenant ID */
  tenantId: string;
  
  /** Associated pipeline execution ID */
  pipelineExecutionId: string;
  
  /** Associated method invocation ID */
  methodInvocationId: string;
  
  /** Method name that triggered this session */
  methodName: string;
  
  /** Session status */
  status: CrucibleSessionStatus;
  
  /** All participants */
  participants: CrucibleParticipant[];
  
  /** LLM participants eligible for deliberation */
  llmParticipantIds: string[];
  
  /** Configuration snapshot */
  config: CrucibleSessionConfig;
  
  /** Pre-prompt sent to participants */
  prePrompt?: CruciblePrePrompt;
  
  /** Total questions asked in session */
  totalQuestionsAsked: number;
  
  /** Total questions remaining */
  questionsRemaining: number;
  
  /** Session start time */
  startedAt: Date;
  
  /** Deliberation start time */
  deliberationStartedAt?: Date;
  
  /** Session end time */
  completedAt?: Date;
  
  /** Error if failed */
  error?: string;
  
  /** Session summary for learning */
  summary?: CrucibleSessionSummary;
}

export interface CrucibleSessionConfig {
  /** Max questions for this session */
  maxQuestions: number;
  
  /** Question timeout (seconds) */
  questionTimeoutSeconds: number;
  
  /** Session timeout (seconds) */
  sessionTimeoutSeconds: number;
  
  /** Cost mode */
  costMode: CrucibleCostMode;
  
  /** Store for learning */
  storeForLearning: boolean;
  
  /** Detect circular reasoning */
  detectCircularReasoning: boolean;
  
  /** Circular citation penalty */
  circularCitationPenalty: number;
}

// =============================================================================
// Deliberation Types
// =============================================================================

export type QuestionType = 
  | 'clarification'      // Asking for clarification on a point
  | 'challenge'          // Challenging an assertion
  | 'evidence'           // Requesting evidence/sources
  | 'reasoning'          // Probing reasoning process
  | 'edge_case'          // Testing edge cases
  | 'contradiction';     // Pointing out contradiction

export type QuestionQuality = 'low' | 'medium' | 'high' | 'exceptional';

/**
 * A question asked during deliberation
 */
export interface CrucibleQuestion {
  /** Unique question ID */
  questionId: string;
  
  /** Session ID */
  sessionId: string;
  
  /** Participant asking the question */
  askerId: string;
  
  /** Participant being questioned */
  targetId: string;
  
  /** Question number in session (1-based) */
  questionNumber: number;
  
  /** Question type classification */
  questionType: QuestionType;
  
  /** The question text */
  questionText: string;
  
  /** Question quality score (if scoring enabled) */
  qualityScore?: QuestionQuality;
  
  /** Whether this question built on previous Q&A */
  isIterativeRefinement: boolean;
  
  /** Previous question ID if iterative */
  previousQuestionId?: string;
  
  /** Timestamp */
  askedAt: Date;
  
  /** The answer */
  answer?: CrucibleAnswer;
}

/**
 * An answer to a Crucible question
 */
export interface CrucibleAnswer {
  /** Unique answer ID */
  answerId: string;
  
  /** Question being answered */
  questionId: string;
  
  /** The answer text */
  answerText: string;
  
  /** Citations/sources mentioned */
  citations: CrucibleCitation[];
  
  /** Circular citation detected */
  circularCitationDetected: boolean;
  
  /** Circular citation details if detected */
  circularCitationDetails?: string;
  
  /** Answer latency (ms) */
  latencyMs: number;
  
  /** Token count */
  tokenCount: number;
  
  /** Timestamp */
  answeredAt: Date;
}

/**
 * A citation in an answer for provenance tracking
 */
export interface CrucibleCitation {
  /** Citation ID */
  citationId: string;
  
  /** Source type */
  sourceType: 'self' | 'other_participant' | 'external' | 'unknown';
  
  /** If citing another participant, their ID */
  sourceParticipantId?: string;
  
  /** Citation text/reference */
  citationText: string;
  
  /** Is this circular (citing someone who cited you)? */
  isCircular: boolean;
}

// =============================================================================
// Final Report Types
// =============================================================================

/**
 * Each LLM's final report after deliberation
 */
export interface CrucibleFinalReport {
  /** Report ID */
  reportId: string;
  
  /** Session ID */
  sessionId: string;
  
  /** Participant ID */
  participantId: string;
  
  /** The refined answer/output */
  refinedOutput: string;
  
  /** How the LLM refined their answer based on deliberation */
  refinementNotes?: string;
  
  /** Confidence level (0-1) */
  confidence: number;
  
  /** Self-assessed accuracy (0-1) */
  selfAssessedAccuracy: number;
  
  /** Key insights from deliberation */
  keyInsights: string[];
  
  /** Weaknesses identified in own answer */
  identifiedWeaknesses: string[];
  
  /** Final score (computed after session) */
  finalScore?: number;
  
  /** Score breakdown */
  scoreBreakdown?: CrucibleScoreBreakdown;
  
  /** Timestamp */
  submittedAt: Date;
}

export interface CrucibleScoreBreakdown {
  /** Base accuracy score */
  accuracyScore: number;
  
  /** Truthfulness score */
  truthfulnessScore: number;
  
  /** Reasoning quality score */
  reasoningScore: number;
  
  /** Completeness score */
  completenessScore: number;
  
  /** Citation quality score */
  citationScore: number;
  
  /** Penalty for circular citations */
  circularCitationPenalty: number;
  
  /** Bonus for high-quality questions asked */
  questionQualityBonus: number;
  
  /** Deliberation participation score */
  deliberationScore: number;
  
  /** Final weighted score */
  weightedTotal: number;
}

// =============================================================================
// Session Summary for Learning
// =============================================================================

/**
 * Session summary stored for learning and audit
 */
export interface CrucibleSessionSummary {
  /** Session ID */
  sessionId: string;
  
  /** Method that triggered session */
  methodName: string;
  
  /** Number of participants */
  participantCount: number;
  
  /** Number of LLM participants */
  llmParticipantCount: number;
  
  /** Total questions asked */
  totalQuestions: number;
  
  /** Questions by type */
  questionsByType: Record<QuestionType, number>;
  
  /** Average question quality */
  avgQuestionQuality: number;
  
  /** Circular citations detected */
  circularCitationsDetected: number;
  
  /** Session duration (ms) */
  sessionDurationMs: number;
  
  /** Deliberation duration (ms) */
  deliberationDurationMs: number;
  
  /** Winner (highest scoring participant) */
  winnerId?: string;
  
  /** Winner model name */
  winnerModelName?: string;
  
  /** Score spread (max - min) */
  scoreSpread: number;
  
  /** Was there meaningful refinement? */
  meaningfulRefinement: boolean;
  
  /** Learning insights extracted */
  learningInsights: CrucibleLearningInsight[];
}

export interface CrucibleLearningInsight {
  /** Insight type */
  type: 'model_strength' | 'model_weakness' | 'question_pattern' | 'answer_pattern' | 'deliberation_dynamic';
  
  /** Model ID if applicable */
  modelId?: string;
  
  /** Insight description */
  description: string;
  
  /** Confidence in this insight */
  confidence: number;
  
  /** Should this inform future sessions? */
  actionable: boolean;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface CreateCrucibleSessionRequest {
  /** Pipeline execution ID */
  pipelineExecutionId: string;
  
  /** Method invocation ID */
  methodInvocationId: string;
  
  /** Method name */
  methodName: string;
  
  /** Participant model IDs */
  participantModelIds: string[];
  
  /** Cost mode override */
  costMode?: CrucibleCostMode;
  
  /** Max questions override */
  maxQuestions?: number;
}

export interface SubmitQuestionRequest {
  /** Session ID */
  sessionId: string;
  
  /** Asking participant ID */
  askerId: string;
  
  /** Target participant ID */
  targetId: string;
  
  /** Question text */
  questionText: string;
  
  /** Question type */
  questionType: QuestionType;
  
  /** Previous question ID if iterative */
  previousQuestionId?: string;
}

export interface SubmitAnswerRequest {
  /** Question ID */
  questionId: string;
  
  /** Answer text */
  answerText: string;
  
  /** Citations */
  citations?: Omit<CrucibleCitation, 'citationId' | 'isCircular'>[];
}

export interface SubmitFinalReportRequest {
  /** Session ID */
  sessionId: string;
  
  /** Participant ID */
  participantId: string;
  
  /** Refined output */
  refinedOutput: string;
  
  /** Refinement notes */
  refinementNotes?: string;
  
  /** Confidence */
  confidence: number;
  
  /** Self-assessed accuracy */
  selfAssessedAccuracy: number;
  
  /** Key insights */
  keyInsights: string[];
  
  /** Identified weaknesses */
  identifiedWeaknesses: string[];
}

export interface CrucibleDashboardData {
  /** Configuration */
  config: CrucibleConfig;
  
  /** Total sessions */
  totalSessions: number;
  
  /** Sessions today */
  sessionsToday: number;
  
  /** Average session duration (ms) */
  avgSessionDuration: number;
  
  /** Average questions per session */
  avgQuestionsPerSession: number;
  
  /** Circular citations detected (last 24h) */
  circularCitationsLast24h: number;
  
  /** Top performing models in Crucible */
  topPerformingModels: CrucibleModelPerformance[];
  
  /** Recent sessions */
  recentSessions: CrucibleSession[];
  
  /** Learning insights (last 7 days) */
  recentInsights: CrucibleLearningInsight[];
}

export interface CrucibleModelPerformance {
  /** Model ID */
  modelId: string;
  
  /** Model name */
  modelName: string;
  
  /** Sessions participated */
  sessionsParticipated: number;
  
  /** Win rate */
  winRate: number;
  
  /** Average score */
  avgScore: number;
  
  /** Question quality average */
  avgQuestionQuality: number;
  
  /** Circular citations rate */
  circularCitationRate: number;
}

// =============================================================================
// Pre-Prompt Template
// =============================================================================

export const CRUCIBLE_PRE_PROMPT_TEMPLATE = `
## Crucible Deliberation Session

You are participating in a **competitive deliberation** with other AI models to provide the best possible response.

### Evaluation Criteria (Weights)
- **Accuracy**: {{accuracyWeight}} (PRIMARY - most important)
- **Truthfulness**: {{truthfulnessWeight}} (HIGH priority - lying will be penalized)
- **Reasoning Quality**: {{reasoningWeight}}
- **Completeness**: {{completenessWeight}}
- **Citation Quality**: {{citationWeight}}

### Other Participants
{{#each participants}}
- **{{modelName}}** ({{provider}}){{#if modelMode}} - Mode: {{modelMode}}{{/if}}{{#if strengths}} - Strengths: {{strengths}}{{/if}}
{{/each}}

### Competition Rules
1. **This is a COMPETITION, not a consensus exercise.** Your goal is to provide the most accurate answer.
2. You may ask up to **{{maxQuestions}}** questions total across all participants.
3. **Questions are FREE** - there is no penalty for asking questions.
4. You may ask questions **iteratively** - learn from one answer before asking the next.
5. Choose which participant(s) to question strategically based on their strengths.

### Provenance & Citations
- **Track provenance** for all claims you make.
- **Circular citations will be detected and penalized.** Do not cite answers that cite your previous statements.
- If another participant cites your work, and you then cite their answer, this is circular reasoning.

### Process
1. First, you'll receive the task/prompt
2. Formulate your initial response
3. Ask questions to other participants to probe weaknesses or gather information
4. Refine your response based on deliberation
5. Submit your final answer

You will be scored and ranked against other participants. The best answer wins.
`;

/**
 * Generate pre-prompt text from template
 */
// =============================================================================
// Hierarchical Configuration Types (System > Tenant > User)
// =============================================================================

/**
 * System-level Crucible defaults (Radiant Admin)
 */
export interface CrucibleSystemConfig {
  id: string;
  defaultMaxQuestions: number;
  questionTimeoutSeconds: number;
  sessionTimeoutSeconds: number;
  minLlmsForCrucible: number;
  defaultCostMode: CrucibleCostMode;
  costModeQuestionLimits: Record<CrucibleCostMode, number>;
  circularCitationPenalty: number;
  allowTenantOverride: boolean;
  allowUserOverride: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tenant-level Crucible overrides (Think Tank Admin)
 */
export interface CrucibleTenantConfig {
  tenantId: string;
  maxQuestionsOverride?: number;
  questionTimeoutOverride?: number;
  sessionTimeoutOverride?: number;
  minLlmsOverride?: number;
  costModeOverride?: CrucibleCostMode;
  costModeLimitsOverride?: Record<CrucibleCostMode, number>;
  circularPenaltyOverride?: number;
  allowUserOverride: boolean;
  showDeliberationToUsers: boolean;
  autoEnableForMultiLlm: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CruciblePreferenceScope = 
  | 'global'              // User's global default
  | 'method'              // Specific method
  | 'workflow'            // Specific workflow template
  | 'method_in_workflow'; // Specific method within a specific workflow

/**
 * User-level Crucible preferences (per method/workflow)
 */
export interface CrucibleUserPreference {
  id: string;
  tenantId: string;
  userId: string;
  scope: CruciblePreferenceScope;
  methodId?: string;
  workflowId?: string;
  maxQuestions?: number;
  costMode?: CrucibleCostMode;
  enabled?: boolean;
  explicitlySet: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolved Crucible config after applying hierarchy
 */
export interface CrucibleResolvedConfig {
  maxQuestions: number;
  questionTimeoutSeconds: number;
  sessionTimeoutSeconds: number;
  minLlmsForCrucible: number;
  costMode: CrucibleCostMode;
  costModeQuestionLimits: Record<CrucibleCostMode, number>;
  circularCitationPenalty: number;
  showDeliberationToUsers: boolean;
  autoEnableForMultiLlm: boolean;
  enabled: boolean;
  source: 'system' | 'tenant' | 'user_global' | 'user_method' | 'user_workflow' | 'user_method_workflow';
}

/**
 * Request to update user preferences
 */
export interface UpdateCruciblePreferenceRequest {
  scope: CruciblePreferenceScope;
  methodId?: string;
  workflowId?: string;
  maxQuestions?: number;
  costMode?: CrucibleCostMode;
  enabled?: boolean;
}

export function generateCruciblePrePrompt(
  criteria: CrucibleEvaluationCriteria,
  participants: CrucibleParticipantInfo[],
  rules: CrucibleCompetitionRules
): string {
  let prompt = CRUCIBLE_PRE_PROMPT_TEMPLATE;
  
  // Replace criteria weights
  prompt = prompt.replace('{{accuracyWeight}}', `${(criteria.accuracyWeight * 100).toFixed(0)}%`);
  prompt = prompt.replace('{{truthfulnessWeight}}', `${(criteria.truthfulnessWeight * 100).toFixed(0)}%`);
  prompt = prompt.replace('{{reasoningWeight}}', `${(criteria.reasoningWeight * 100).toFixed(0)}%`);
  prompt = prompt.replace('{{completenessWeight}}', `${(criteria.completenessWeight * 100).toFixed(0)}%`);
  prompt = prompt.replace('{{citationWeight}}', `${(criteria.citationWeight * 100).toFixed(0)}%`);
  
  // Replace max questions
  prompt = prompt.replace('{{maxQuestions}}', rules.maxQuestions.toString());
  
  // Replace participants list
  const participantLines = participants.map(p => {
    let line = `- **${p.modelName}** (${p.provider})`;
    if (p.modelMode) line += ` - Mode: ${p.modelMode}`;
    if (p.strengths && p.strengths.length > 0) line += ` - Strengths: ${p.strengths.join(', ')}`;
    return line;
  }).join('\n');
  
  prompt = prompt.replace(/{{#each participants}}[\s\S]*?{{\/each}}/g, participantLines);
  
  return prompt;
}
