/**
 * AXIOM/CLARION Type Definitions
 * 
 * Centralized TypeScript interfaces for the AXIOM prompt optimization
 * and CLARION adaptive questioning systems.
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

// =============================================================================
// Core Types
// =============================================================================

export type WorkflowStep = 'classify' | 'clarify' | 'compile' | 'route';
export type StepStatus = 'pending' | 'active' | 'completed';
export type SessionStatus = 
  | 'active' 
  | 'ready_to_compile' 
  | 'awaiting_clarification' 
  | 'completed' 
  | 'abandoned';

export type QuestionType = 'choice' | 'multi_select' | 'text' | 'scale' | 'boolean';
export type FeedbackSignal = 'positive' | 'negative' | 'neutral';
export type FeedbackType = 
  | 'domain_accuracy'
  | 'question_relevance'
  | 'prompt_quality'
  | 'model_selection'
  | 'overall';

export type ClarificationMode = 'always' | 'auto' | 'never';

// =============================================================================
// Domain Types
// =============================================================================

export interface Domain {
  id: string;
  path: string[];
  name: string;
  displayName: string;
  confidence: number;
  relatedDomains?: string[];
  icon?: string;
}

export interface DomainSignature {
  domainId: string;
  requiredSlots: string[];
  optionalSlots: string[];
  defaultPatterns: string[];
}

// =============================================================================
// Question Types
// =============================================================================

export interface LocalizedText {
  en: string;
  [locale: string]: string | undefined;
}

export interface LocalizedOptions {
  en: string[];
  [locale: string]: string[] | undefined;
}

export interface Question {
  questionId: string;
  type: QuestionType;
  text: LocalizedText;
  hint?: LocalizedText;
  options?: LocalizedOptions;
  optionDescriptions?: LocalizedOptions;
  category: string;
  priority: number;
  minLength?: number;
  maxLength?: number;
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { low: string; high: string };
}

export interface QuestionAnswer {
  questionId: string;
  answer: string | string[] | number | boolean;
  answeredAt: string;
  skipped: boolean;
  skipReason?: string;
}

// =============================================================================
// Model Types
// =============================================================================

export interface ModelScore {
  modelId: string;
  modelName: string;
  provider: string;
  score: number;
  previousScore?: number;
  isLeading: boolean;
  reasons: string[];
  capabilities?: string[];
  costPerToken?: number;
}

export interface ModelPrediction {
  modelId: string;
  modelName: string;
  provider: string;
  score: number;
  reasons?: string[];
}

export interface ModelSelection {
  modelId: string;
  modelName: string;
  provider: string;
  confidence: number;
  reasoning: string;
}

// =============================================================================
// Workflow Types
// =============================================================================

export interface WorkflowStepInfo {
  step: WorkflowStep;
  label: string;
  status: StepStatus;
  completedAt?: string;
}

export interface WorkflowProgress {
  currentStep: WorkflowStep;
  steps: WorkflowStepInfo[];
  overallProgress: number;
  confidence: number;
}

// =============================================================================
// Prompt Types
// =============================================================================

export interface CompiledPrompt {
  systemPrompt: string;
  userPrompt: string;
  modelId: string;
  modelName: string;
  tokenCount: number;
  patterns?: string[];
  optimizations?: string[];
}

export interface PromptPattern {
  patternId: string;
  name: string;
  template: string;
  domain: string;
  effectiveness: number;
  usageCount: number;
}

// =============================================================================
// Session Types
// =============================================================================

export interface AxiomSession {
  sessionId: string;
  status: SessionStatus;
  query: string;
  domain: Domain | null;
  currentQuestion: Question | null;
  answeredQuestions: QuestionAnswer[];
  modelScores: ModelScore[];
  compiledPrompt: CompiledPrompt | null;
  workflow: WorkflowProgress;
  startedAt: string;
  completedAt?: string;
}

export interface AxiomSessionState {
  sessionId: string | null;
  status: SessionStatus;
  workflow: WorkflowProgress;
  domain: Domain | null;
  currentQuestion: Question | null;
  answeredCount: number;
  modelScores: ModelScore[];
  compiledPrompt: CompiledPrompt | null;
  isLoading: boolean;
  error: string | null;
}

// =============================================================================
// Preferences Types
// =============================================================================

export interface ClarionPreferences {
  clarificationMode: ClarificationMode;
  maxQuestions: number;
  showModelScores: boolean;
  showConfidenceMeter: boolean;
  showDomainDetails: boolean;
  animationsEnabled: boolean;
  soundEnabled: boolean;
  rememberAnswers: boolean;
  learnPreferences: boolean;
  autoSkipKnownAnswers: boolean;
}

export const DEFAULT_CLARION_PREFERENCES: ClarionPreferences = {
  clarificationMode: 'auto',
  maxQuestions: 5,
  showModelScores: true,
  showConfidenceMeter: true,
  showDomainDetails: true,
  animationsEnabled: true,
  soundEnabled: false,
  rememberAnswers: true,
  learnPreferences: true,
  autoSkipKnownAnswers: false,
};

// =============================================================================
// SSE Event Types
// =============================================================================

export type AxiomEventType = 
  | 'connected'
  | 'session_started'
  | 'domain_detected'
  | 'domain_refined'
  | 'question_selected'
  | 'answer_received'
  | 'model_scores_update'
  | 'confidence_update'
  | 'clarification_complete'
  | 'compilation_started'
  | 'compilation_complete'
  | 'session_error'
  | 'heartbeat';

export interface AxiomEvent<T = unknown> {
  type: AxiomEventType;
  timestamp: string;
  sessionId: string;
  data: T;
}

export interface DomainDetectedEvent {
  domain: Domain;
  alternatives: Domain[];
}

export interface ModelScoresUpdateEvent {
  scores: ModelScore[];
  leadingModel: string;
  confidence: number;
}

export interface ConfidenceUpdateEvent {
  confidence: number;
  threshold: number;
  readyToCompile: boolean;
}

export interface NextQuestionEvent {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  canSkip: boolean;
}

export interface ClarificationCompleteEvent {
  domain: Domain;
  answeredCount: number;
  skippedCount: number;
  confidence: number;
}

export interface CompilationCompleteEvent {
  prompt: CompiledPrompt;
  model: ModelSelection;
}

export interface AxiomErrorEvent {
  code: string;
  message: string;
  retryable: boolean;
}

// =============================================================================
// Feedback Types
// =============================================================================

export interface FeedbackData {
  type: FeedbackType;
  signal: FeedbackSignal;
  rating?: number;
  comment?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// API Types
// =============================================================================

export interface StartSessionRequest {
  query: string;
  locale?: string;
  preferences?: Partial<ClarionPreferences>;
  context?: Record<string, unknown>;
}

export interface StartSessionResponse {
  sessionId: string;
  status: SessionStatus;
  domain: Domain;
  domainConfidence: number;
  currentQuestion: Question | null;
  modelPredictions: ModelPrediction[];
}

export interface SubmitAnswerRequest {
  questionId: string;
  answer: string | string[] | number | boolean;
}

export interface SubmitAnswerResponse {
  status: SessionStatus;
  nextQuestion: Question | null;
  modelPredictions: ModelPrediction[];
  confidence: number;
  readyToCompile: boolean;
}

export interface SkipQuestionRequest {
  questionId: string;
  reason?: string;
}

export interface SkipQuestionResponse {
  status: SessionStatus;
  nextQuestion: Question | null;
  modelPredictions: ModelPrediction[];
  confidence: number;
  readyToCompile: boolean;
}

export interface CompilePromptRequest {
  editedPrompt?: string;
  selectedModelId?: string;
}

export interface CompilePromptResponse {
  prompt: CompiledPrompt;
  model: ModelSelection;
}

// =============================================================================
// Delight Types
// =============================================================================

export interface ProgressMessage {
  id: string;
  text: string;
  icon?: string;
  duration?: number;
}

export interface ChemistryMoment {
  type: 'score_shift' | 'consensus' | 'new_leader';
  message: string;
  icon: string;
  modelId?: string;
  scoreDelta?: number;
}

export interface DomainPhrasing {
  [questionKey: string]: string;
}

export interface DelightConfig {
  progressMessages: {
    afterFirstQuestion: string[];
    afterSecondQuestion: string[];
    nearingCompletion: string[];
  };
  chemistryThresholds: {
    significantScoreShift: number;
    strongConsensus: number;
    consensusGap: number;
  };
  domainPhrasing: Record<string, DomainPhrasing>;
}

// =============================================================================
// Cache Types
// =============================================================================

export interface CachedQuestionTree {
  domainId: string;
  questions: Question[];
  cachedAt: number;
  expiresAt: number;
}

export interface AnswerHistory {
  questionId: string;
  answer: string | string[] | number | boolean;
  usedAt: string;
  frequency: number;
}

export interface QuestionCache {
  [domainId: string]: CachedQuestionTree;
}
