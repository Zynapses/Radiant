// RADIANT v4.18.0 - AGI Response Types
// Unified response envelope for all model outputs including files, questions, and structured data

// ============================================================================
// Response Content Types
// ============================================================================

export type ContentType = 
  | 'text'           // Plain or markdown text
  | 'structured'     // JSON/structured data
  | 'table'          // Tabular data
  | 'code'           // Code with language
  | 'image'          // Generated or referenced image
  | 'file'           // Downloadable file artifact
  | 'citation'       // Reference/citation
  | 'question'       // Question back to user
  | 'action'         // Suggested action
  | 'summary'        // Summary of multi-model output
  | 'thinking'       // Model's thinking/reasoning trace
  | 'error';         // Error or warning

export type ArtifactType = 
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/svg+xml'
  | 'application/pdf'
  | 'text/plain'
  | 'text/markdown'
  | 'text/html'
  | 'text/csv'
  | 'application/json'
  | 'application/xml'
  | 'audio/mpeg'
  | 'audio/wav'
  | 'video/mp4'
  | 'application/zip'
  | 'application/octet-stream';

// ============================================================================
// Content Blocks
// ============================================================================

export interface TextContent {
  type: 'text';
  format: 'plain' | 'markdown' | 'html';
  content: string;
  language?: string;  // For i18n
}

export interface StructuredContent {
  type: 'structured';
  schema?: string;    // Optional JSON schema reference
  data: Record<string, unknown>;
  displayHint?: 'json' | 'yaml' | 'table' | 'tree' | 'custom';
}

export interface TableContent {
  type: 'table';
  title?: string;
  headers: string[];
  rows: (string | number | boolean | null)[][];
  footnotes?: string[];
  sortable?: boolean;
}

export interface CodeContent {
  type: 'code';
  language: string;
  code: string;
  filename?: string;
  executable?: boolean;
  highlightLines?: number[];
}

export interface ImageContent {
  type: 'image';
  url?: string;           // Direct URL or signed S3 URL
  artifactId?: string;    // Reference to artifact in pipeline
  base64?: string;        // Inline base64 (small images only)
  mimeType: ArtifactType;
  alt: string;
  width?: number;
  height?: number;
  caption?: string;
}

export interface FileArtifact {
  type: 'file';
  artifactId: string;     // Unique ID for pipeline tracking
  filename: string;
  mimeType: ArtifactType;
  size: number;           // Bytes
  url?: string;           // Signed download URL
  s3Key?: string;         // S3 storage key
  checksum?: string;      // SHA-256 for integrity
  metadata?: Record<string, string>;
  generatedBy: {
    stepId: string;
    modelId: string;
    timestamp: string;
  };
  expiresAt?: string;     // URL expiration
}

export interface CitationContent {
  type: 'citation';
  index: number;          // Citation number in document
  text: string;           // The cited claim
  source: {
    type: 'url' | 'paper' | 'book' | 'document' | 'data';
    title: string;
    url?: string;
    authors?: string[];
    date?: string;
    page?: string;
    doi?: string;
  };
  confidence?: number;    // How confident in this citation (0-1)
}

export interface QuestionContent {
  type: 'question';
  questionId: string;     // For tracking response
  question: string;
  context?: string;       // Why asking
  options?: {
    id: string;
    label: string;
    description?: string;
  }[];
  inputType: 'text' | 'choice' | 'multiChoice' | 'file' | 'confirmation';
  required: boolean;
  default?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    allowedTypes?: string[];  // For file inputs
  };
  timeout?: number;       // Auto-proceed after N seconds
  blocksExecution: boolean;  // Must answer before continuing
}

export interface ActionContent {
  type: 'action';
  actionId: string;
  label: string;
  description: string;
  actionType: 'navigate' | 'download' | 'execute' | 'external' | 'copy';
  payload: Record<string, unknown>;
  requiresConfirmation?: boolean;
  icon?: string;
}

export interface ThinkingContent {
  type: 'thinking';
  thought: string;
  stepNumber?: number;
  duration?: number;      // How long this thinking took
  collapsed?: boolean;    // UI hint to collapse by default
}

export interface SummaryContent {
  type: 'summary';
  title: string;
  overview: string;
  keyPoints: string[];
  modelsUsed: {
    modelId: string;
    role: string;         // What this model contributed
    confidence: number;
  }[];
  artifacts: string[];    // artifactIds included
  wordCount: number;
  readingTime: string;    // "5 min read"
}

export interface ErrorContent {
  type: 'error';
  severity: 'info' | 'warning' | 'error' | 'fatal';
  code: string;
  message: string;
  details?: string;
  recoverable: boolean;
  suggestedAction?: string;
}

export type ResponseContent = 
  | TextContent
  | StructuredContent
  | TableContent
  | CodeContent
  | ImageContent
  | FileArtifact
  | CitationContent
  | QuestionContent
  | ActionContent
  | ThinkingContent
  | SummaryContent
  | ErrorContent;

// ============================================================================
// Response Envelope
// ============================================================================

export interface ModelResponseMetadata {
  modelId: string;
  modelName: string;
  provider: string;
  temperature?: number;
  maxTokens?: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;  // For extended thinking models
  latencyMs: number;
  costCents: number;
  cached: boolean;
  truncated: boolean;
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_use' | 'error';
}

export interface PipelineContext {
  planId: string;
  stepId: string;
  stepNumber: number;
  totalSteps: number;
  orchestrationMode: string;
  previousArtifacts: string[];  // artifactIds from previous steps
  accumulatedContext: string;   // Summary of previous outputs
}

export interface AGIResponse {
  responseId: string;
  timestamp: string;
  
  // Content blocks in display order
  content: ResponseContent[];
  
  // Model metadata
  model: ModelResponseMetadata;
  
  // Pipeline context (if part of multi-step plan)
  pipeline?: PipelineContext;
  
  // Questions requiring user input
  pendingQuestions: QuestionContent[];
  
  // File artifacts generated
  artifacts: FileArtifact[];
  
  // Citations collected
  citations: CitationContent[];
  
  // Processing state
  status: 'streaming' | 'complete' | 'awaiting_input' | 'error';
  
  // For streaming responses
  streamPosition?: number;
  
  // Quality metrics
  quality?: {
    confidence: number;
    coherence: number;
    factuality?: number;
    relevance: number;
  };
}

// ============================================================================
// Multi-Model Synthesis
// ============================================================================

export interface ModelContribution {
  modelId: string;
  modelName: string;
  role: 'primary' | 'verifier' | 'specialist' | 'synthesizer';
  response: AGIResponse;
  weight: number;         // How much this contributed to final
  agreement?: number;     // Agreement with other models (0-1)
}

export interface SynthesisStrategy {
  type: 'merge' | 'vote' | 'chain' | 'parallel' | 'consensus';
  conflictResolution: 'primary_wins' | 'majority_vote' | 'highest_confidence' | 'manual';
  minAgreement?: number;  // Minimum agreement threshold
  requireUnanimity?: boolean;
}

export interface SynthesizedResponse {
  responseId: string;
  timestamp: string;
  
  // The synthesized content
  content: ResponseContent[];
  
  // Summary of synthesis process
  synthesis: {
    strategy: SynthesisStrategy;
    modelsUsed: number;
    totalTokens: number;
    totalCostCents: number;
    totalLatencyMs: number;
    agreementScore: number;
    conflictsResolved: number;
  };
  
  // Individual model contributions (for transparency)
  contributions: ModelContribution[];
  
  // Merged artifacts from all models
  artifacts: FileArtifact[];
  
  // Merged citations
  citations: CitationContent[];
  
  // Any unresolved questions
  pendingQuestions: QuestionContent[];
  
  // Final summary for UI
  summary: SummaryContent;
  
  status: 'complete' | 'awaiting_input' | 'partial';
}

// ============================================================================
// Client Communication Events
// ============================================================================

export type ClientEventType = 
  | 'plan_ready'
  | 'step_started'
  | 'step_progress'
  | 'step_complete'
  | 'question_pending'
  | 'question_answered'
  | 'artifact_ready'
  | 'synthesis_started'
  | 'synthesis_complete'
  | 'response_complete'
  | 'error';

export interface ClientEvent {
  eventId: string;
  type: ClientEventType;
  timestamp: string;
  planId: string;
  stepId?: string;
  
  // Event-specific payload
  payload: {
    // For step events
    stepNumber?: number;
    stepTitle?: string;
    progress?: number;      // 0-100
    
    // For questions
    question?: QuestionContent;
    
    // For artifacts
    artifact?: FileArtifact;
    
    // For responses
    response?: AGIResponse;
    synthesized?: SynthesizedResponse;
    
    // For errors
    error?: ErrorContent;
    
    // Progress message
    message?: string;
  };
}

// ============================================================================
// User Answers
// ============================================================================

export interface UserAnswer {
  questionId: string;
  timestamp: string;
  
  // Answer based on input type
  textValue?: string;
  selectedOptions?: string[];
  fileArtifactId?: string;
  confirmed?: boolean;
  
  // Timeout/skip
  skipped?: boolean;
  timedOut?: boolean;
}

export interface ConversationContext {
  sessionId: string;
  conversationId: string;
  userId: string;
  tenantId: string;
  
  // Accumulated Q&A for context
  questionsAnswered: {
    question: QuestionContent;
    answer: UserAnswer;
  }[];
  
  // User preferences discovered
  preferences: Record<string, unknown>;
}
