// AGI Brain/Ideas Types
// Real-time prompt suggestions and result enhancement

// ============================================================================
// TYPEAHEAD SUGGESTIONS (As user types)
// ============================================================================

export type SuggestionType = 
  | 'completion'      // Complete the current thought
  | 'refinement'      // Improve/clarify the prompt
  | 'expansion'       // Expand scope of inquiry
  | 'alternative'     // Different angle on same topic
  | 'follow_up'       // Natural next question
  | 'clarification';  // Ask for more details

export type SuggestionSource =
  | 'pattern_match'   // Based on common prompt patterns
  | 'domain_aware'    // Based on detected domain
  | 'user_history'    // Based on user's past prompts
  | 'trending'        // Popular queries in this domain
  | 'ai_generated';   // Real-time AI suggestion

export interface PromptSuggestion {
  id: string;
  text: string;
  type: SuggestionType;
  source: SuggestionSource;
  confidence: number; // 0-1
  relevanceScore: number; // 0-1
  metadata?: {
    domainId?: string;
    domainName?: string;
    basedOnPattern?: string;
    estimatedComplexity?: 'simple' | 'moderate' | 'complex';
  };
}

export interface TypeaheadRequest {
  partialPrompt: string;
  cursorPosition: number;
  userId: string;
  sessionId?: string;
  domainHint?: string;
  maxSuggestions?: number;
  includeTypes?: SuggestionType[];
}

export interface TypeaheadResponse {
  suggestions: PromptSuggestion[];
  detectedDomain?: {
    fieldId: string;
    fieldName: string;
    domainId?: string;
    domainName?: string;
    confidence: number;
  };
  processingTimeMs: number;
}

// ============================================================================
// RESULT IDEAS (In synthesized response)
// ============================================================================

export type IdeaCategory =
  | 'explore_further'    // Dig deeper into this topic
  | 'related_topic'      // Adjacent areas to explore
  | 'practical_next'     // Concrete next steps
  | 'alternative_view'   // Different perspectives
  | 'verification'       // Ways to verify the answer
  | 'resource'           // Helpful resources
  | 'warning';           // Potential pitfalls

export interface ResultIdea {
  id: string;
  category: IdeaCategory;
  title: string;
  description: string;
  suggestedPrompt?: string; // Click to ask this
  confidence: number;
  priority: number; // 1-10, higher = more relevant
  metadata?: {
    sourceModel?: string;
    basedOnSection?: string;
    domainSpecific?: boolean;
  };
}

export interface ResultIdeasSection {
  ideas: ResultIdea[];
  totalGenerated: number;
  filteredCount: number;
  generationTimeMs: number;
}

// ============================================================================
// PROACTIVE SUGGESTIONS (Push notifications)
// ============================================================================

export interface ProactiveSuggestion {
  id: string;
  userId: string;
  tenantId: string;
  triggerType: 'time_based' | 'context_based' | 'learning_based';
  suggestion: {
    title: string;
    description: string;
    suggestedPrompt: string;
    category: IdeaCategory;
  };
  relevanceContext?: {
    basedOnConversation?: string;
    basedOnDomain?: string;
    basedOnTimePattern?: string;
  };
  expiresAt?: Date;
  dismissed: boolean;
  clicked: boolean;
  createdAt: Date;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface AGIIdeasConfig {
  // Typeahead settings
  typeahead: {
    enabled: boolean;
    minCharsToTrigger: number; // Default: 3
    maxSuggestions: number; // Default: 5
    debounceMs: number; // Default: 150
    includeSources: SuggestionSource[];
    useAIGeneration: boolean; // Real-time AI suggestions (slower, better)
  };
  
  // Result ideas settings
  resultIdeas: {
    enabled: boolean;
    maxIdeas: number; // Default: 5
    minConfidence: number; // Default: 0.6
    categories: IdeaCategory[];
    showInModes: string[]; // Orchestration modes to show ideas
  };
  
  // Proactive settings
  proactive: {
    enabled: boolean;
    maxPerDay: number;
    quietHoursStart?: number; // Hour (0-23)
    quietHoursEnd?: number;
  };
}

export const DEFAULT_AGI_IDEAS_CONFIG: AGIIdeasConfig = {
  typeahead: {
    enabled: true,
    minCharsToTrigger: 3,
    maxSuggestions: 5,
    debounceMs: 150,
    includeSources: ['pattern_match', 'domain_aware', 'user_history'],
    useAIGeneration: false,
  },
  resultIdeas: {
    enabled: true,
    maxIdeas: 5,
    minConfidence: 0.6,
    categories: ['explore_further', 'related_topic', 'practical_next'],
    showInModes: ['research', 'analysis', 'thinking', 'extended_thinking'],
  },
  proactive: {
    enabled: false,
    maxPerDay: 3,
  },
};

// ============================================================================
// API TYPES
// ============================================================================

export interface GenerateIdeasRequest {
  responseText: string;
  promptText: string;
  orchestrationMode: string;
  domainId?: string;
  userId: string;
  maxIdeas?: number;
}

export interface GenerateIdeasResponse {
  ideas: ResultIdea[];
  processingTimeMs: number;
}

// Common prompt patterns for pattern matching
export const PROMPT_PATTERNS: Record<string, { pattern: RegExp; suggestions: string[] }> = {
  howTo: {
    pattern: /^how (do|can|to|would)/i,
    suggestions: [
      'step by step',
      'with examples',
      'for beginners',
      'best practices',
    ],
  },
  explain: {
    pattern: /^(explain|what is|what are|describe)/i,
    suggestions: [
      'in simple terms',
      'with analogies',
      'the key concepts',
      'pros and cons',
    ],
  },
  compare: {
    pattern: /^(compare|difference|versus|vs)/i,
    suggestions: [
      'with a table',
      'key differences',
      'which is better for',
      'trade-offs',
    ],
  },
  code: {
    pattern: /^(write|create|build|implement|code)/i,
    suggestions: [
      'with error handling',
      'with tests',
      'with documentation',
      'production-ready',
    ],
  },
  analyze: {
    pattern: /^(analyze|review|evaluate|assess)/i,
    suggestions: [
      'strengths and weaknesses',
      'with recommendations',
      'risk assessment',
      'detailed breakdown',
    ],
  },
};
