/**
 * Context Anchor Service
 * 
 * Implements the "Context Anchor Gate" from the Cognitive Precision Protocols.
 * Extracts role, audience, and gap from user requests to ensure sufficient
 * context before generation proceeds.
 * 
 * Key principle: "Refuse to generate until anchored" - forces the model to
 * explicitly confirm context before proceeding, reducing latent space entropy.
 * 
 * @version 1.0.0
 * @since v7.10.0
 */

import { Pool } from 'pg';
import {
  ContextAnchor,
  ContextAnchorTaskType,
  ContextAnchorGateConfig,
  ContextAnchorGateResult,
  DEFAULT_CONTEXT_ANCHOR_CONFIG,
  NegativeConstraint,
  ConstraintInjectionResult,
} from '@radiant/shared';

export interface ContextAnchorServiceDeps {
  pool: Pool;
  llmClient: {
    complete: (params: {
      model: string;
      messages: { role: string; content: string }[];
      temperature?: number;
      maxTokens?: number;
    }) => Promise<{ content: string; tokensUsed: number }>;
  };
}

/**
 * Task type detection patterns
 */
const TASK_TYPE_PATTERNS: Record<ContextAnchorTaskType, RegExp[]> = {
  code_generation: [
    /\b(write|create|implement|build|generate|make|add)\b.*\b(function|class|method|code|component|api|endpoint|service)\b/i,
    /\b(can you|please|could you)\b.*\b(write|code|implement)\b/i,
  ],
  code_review: [
    /\b(review|check|analyze|audit|examine)\b.*\b(code|implementation|pr|pull request)\b/i,
    /\bwhat('s| is) wrong with\b/i,
  ],
  explanation: [
    /\b(explain|describe|what is|how does|why does|tell me about)\b/i,
    /\bcan you explain\b/i,
  ],
  debugging: [
    /\b(debug|fix|error|bug|issue|problem|broken|not working|doesn't work)\b/i,
    /\bwhy (is|does|am I getting)\b/i,
  ],
  architecture: [
    /\b(design|architect|structure|organize|plan)\b.*\b(system|application|service|database)\b/i,
    /\b(best practice|pattern|approach)\b.*\b(for|to)\b/i,
  ],
  creative_writing: [
    /\b(write|compose|draft|create)\b.*\b(story|poem|essay|blog|article|email|message)\b/i,
  ],
  data_analysis: [
    /\b(analyze|examine|explore|investigate)\b.*\b(data|dataset|metrics|numbers|statistics)\b/i,
  ],
  question_answering: [
    /^(what|who|when|where|which|how many|how much|is|are|can|does|do|will|should)\b/i,
  ],
  summarization: [
    /\b(summarize|summary|tldr|brief|condense|shorten)\b/i,
  ],
  translation: [
    /\b(translate|convert|transform)\b.*\b(to|into|from)\b/i,
  ],
  unknown: [],
};

/**
 * Role extraction patterns
 */
const ROLE_PATTERNS: { pattern: RegExp; role: string }[] = [
  { pattern: /\b(as a|acting as|you are a|pretend you're a)\s+([^,.]+)/i, role: '$2' },
  { pattern: /\b(senior|junior|lead|principal|staff)\s+(engineer|developer|architect)/i, role: '$1 $2' },
  { pattern: /\b(backend|frontend|fullstack|devops|data|ml)\s+(engineer|developer)/i, role: '$1 $2' },
];

/**
 * Audience extraction patterns
 */
const AUDIENCE_PATTERNS: { pattern: RegExp; audience: string }[] = [
  { pattern: /\b(for|to|targeting)\s+(beginners|experts|seniors|juniors|non-technical|technical)\b/i, audience: '$2' },
  { pattern: /\b(explain|describe).*\b(simply|like I'm 5|in simple terms|for a child)\b/i, audience: 'beginners' },
  { pattern: /\b(detailed|in-depth|comprehensive|advanced)\b/i, audience: 'experts' },
];

/**
 * Default negative constraints by task type
 */
const DEFAULT_NEGATIVE_CONSTRAINTS: NegativeConstraint[] = [
  // Code generation constraints
  {
    id: 'no-stubs',
    constraint: 'Do NOT use placeholder code, stubs, TODOs, or "// implement here" comments',
    category: 'content',
    severity: 'hard',
    appliesToTaskTypes: ['code_generation', 'debugging'],
  },
  {
    id: 'no-hardcoded',
    constraint: 'Do NOT hardcode values that should be configurable',
    category: 'content',
    severity: 'soft',
    appliesToTaskTypes: ['code_generation', 'architecture'],
  },
  {
    id: 'no-incomplete',
    constraint: 'Do NOT provide partial implementations - complete the entire requested feature',
    category: 'content',
    severity: 'hard',
    appliesToTaskTypes: ['code_generation'],
  },
  // Behavioral constraints
  {
    id: 'no-sycophancy',
    constraint: 'Do NOT agree with the user just to please them - provide honest, accurate information',
    category: 'behavior',
    severity: 'hard',
    appliesToTaskTypes: ['code_review', 'architecture', 'explanation'],
  },
  {
    id: 'no-hedging',
    constraint: 'Do NOT use excessive hedging language like "might", "could possibly", "perhaps"',
    category: 'style',
    severity: 'soft',
    appliesToTaskTypes: ['explanation', 'architecture'],
  },
  // Format constraints
  {
    id: 'no-fluff',
    constraint: 'Do NOT add unnecessary preamble or filler content',
    category: 'format',
    severity: 'soft',
    appliesToTaskTypes: ['code_generation', 'summarization', 'question_answering'],
  },
];

export class ContextAnchorService {
  private pool: Pool;
  private llmClient: ContextAnchorServiceDeps['llmClient'];
  private configCache: Map<string, { config: ContextAnchorGateConfig; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60000;

  constructor(deps: ContextAnchorServiceDeps) {
    this.pool = deps.pool;
    this.llmClient = deps.llmClient;
  }

  /**
   * Get context anchor gate configuration for a tenant
   */
  async getConfig(tenantId: string): Promise<ContextAnchorGateConfig> {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.config;
    }

    try {
      const result = await this.pool.query(
        `SELECT config FROM context_anchor_config WHERE tenant_id = $1`,
        [tenantId]
      );

      let config: ContextAnchorGateConfig;
      if (result.rows.length === 0) {
        config = { ...DEFAULT_CONTEXT_ANCHOR_CONFIG };
      } else {
        config = { ...DEFAULT_CONTEXT_ANCHOR_CONFIG, ...result.rows[0].config };
      }

      this.configCache.set(tenantId, { config, timestamp: Date.now() });
      return config;
    } catch {
      return { ...DEFAULT_CONTEXT_ANCHOR_CONFIG };
    }
  }

  /**
   * Detect task type from user input
   */
  detectTaskType(input: string): ContextAnchorTaskType {
    for (const [taskType, patterns] of Object.entries(TASK_TYPE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          return taskType as ContextAnchorTaskType;
        }
      }
    }
    return 'unknown';
  }

  /**
   * Extract context anchor using pattern matching (fast path)
   */
  extractContextPatternBased(input: string): Partial<ContextAnchor> {
    let role: string | null = null;
    let audience: string | null = null;
    const keywordsFound: string[] = [];

    // Extract role
    for (const { pattern } of ROLE_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        role = match[2] || match[0];
        keywordsFound.push('role');
        break;
      }
    }

    // Extract audience
    for (const { pattern } of AUDIENCE_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        audience = match[2] || 'general';
        keywordsFound.push('audience');
        break;
      }
    }

    // Calculate implicit context score based on input length and specificity
    const implicitContextScore = Math.min(1.0, input.length / 500) * 0.5 +
      (input.includes('?') ? 0.1 : 0) +
      (input.split('\n').length > 3 ? 0.2 : 0) +
      (input.includes('```') ? 0.2 : 0);

    return {
      role,
      audience,
      extractionMetadata: {
        sourceLength: input.length,
        keywordsFound,
        implicitContextScore,
        explicitContextScore: keywordsFound.length * 0.25,
      },
    };
  }

  /**
   * Extract context anchor using LLM (accurate path)
   */
  async extractContextLLM(input: string): Promise<Partial<ContextAnchor>> {
    const extractionPrompt = `Analyze the following user request and extract context:

USER REQUEST:
"""
${input}
"""

Extract the following in JSON format:
{
  "role": "The role/persona the AI should assume (null if not specified)",
  "audience": "The intended audience for the response (null if not specified)",
  "gap": "The knowledge or capability gap being addressed",
  "taskType": "One of: code_generation, code_review, explanation, debugging, architecture, creative_writing, data_analysis, question_answering, summarization, translation, unknown",
  "clarifyingQuestions": ["List 1-3 questions that would help clarify the request if context is missing"]
}

Respond ONLY with valid JSON.`;

    try {
      const response = await this.llmClient.complete({
        model: 'anthropic/claude-3-haiku-20240307',
        messages: [{ role: 'user', content: extractionPrompt }],
        temperature: 0.1,
        maxTokens: 500,
      });

      const parsed = JSON.parse(response.content);
      return {
        role: parsed.role || null,
        audience: parsed.audience || null,
        gap: parsed.gap || null,
        taskType: parsed.taskType || 'unknown',
        clarifyingQuestions: parsed.clarifyingQuestions || [],
      };
    } catch {
      return {};
    }
  }

  /**
   * Main entry point: Evaluate context anchor gate
   */
  async evaluateGate(
    tenantId: string,
    input: string,
    config?: Partial<ContextAnchorGateConfig>
  ): Promise<ContextAnchorGateResult> {
    const startTime = Date.now();
    const gateConfig = { ...(await this.getConfig(tenantId)), ...config };

    // If gate is disabled, always proceed
    if (!gateConfig.enabled) {
      return {
        proceed: true,
        anchor: this.createEmptyAnchor(input),
        action: 'PROCEED',
        clarifyingQuestions: [],
        systemPromptAugmentation: null,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Detect task type first
    const taskType = this.detectTaskType(input);

    // Skip gate for certain task types
    if (gateConfig.skipAnchorTaskTypes.includes(taskType)) {
      return {
        proceed: true,
        anchor: this.createEmptyAnchor(input, taskType),
        action: 'PROCEED',
        clarifyingQuestions: [],
        systemPromptAugmentation: null,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Extract context (pattern-based or LLM)
    let extractedContext: Partial<ContextAnchor>;
    if (gateConfig.useLLMExtraction) {
      extractedContext = await this.extractContextLLM(input);
    } else {
      extractedContext = this.extractContextPatternBased(input);
    }

    // Merge with pattern-based extraction for metadata
    const patternContext = this.extractContextPatternBased(input);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(extractedContext, patternContext);
    
    // Build full anchor
    const anchor: ContextAnchor = {
      role: extractedContext.role || null,
      audience: extractedContext.audience || null,
      gap: extractedContext.gap || null,
      confidence,
      isAnchored: confidence >= gateConfig.minConfidenceThreshold,
      clarifyingQuestions: extractedContext.clarifyingQuestions || [],
      taskType: extractedContext.taskType || taskType,
      extractionMetadata: patternContext.extractionMetadata || {
        sourceLength: input.length,
        keywordsFound: [],
        implicitContextScore: 0,
        explicitContextScore: 0,
      },
    };

    // Determine action
    let action: 'PROCEED' | 'CLARIFY' | 'OVERRIDE_ALLOWED';
    let proceed: boolean;

    if (anchor.isAnchored && !gateConfig.alwaysClarifyTaskTypes.includes(anchor.taskType)) {
      action = 'PROCEED';
      proceed = true;
    } else if (gateConfig.alwaysClarifyTaskTypes.includes(anchor.taskType) && !anchor.isAnchored) {
      action = 'CLARIFY';
      proceed = false;
    } else if (gateConfig.allowOverride) {
      action = 'OVERRIDE_ALLOWED';
      proceed = true; // Allow but flag
    } else {
      action = 'CLARIFY';
      proceed = false;
    }

    // Generate system prompt augmentation if anchored
    const systemPromptAugmentation = anchor.isAnchored
      ? this.generateSystemPromptAugmentation(anchor)
      : null;

    return {
      proceed,
      anchor,
      action,
      clarifyingQuestions: anchor.clarifyingQuestions.slice(0, gateConfig.maxClarifyingQuestions),
      systemPromptAugmentation,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Calculate confidence score from extracted context
   */
  private calculateConfidence(
    extracted: Partial<ContextAnchor>,
    pattern: Partial<ContextAnchor>
  ): number {
    let score = 0;

    // Role detected: +0.3
    if (extracted.role) score += 0.3;
    
    // Audience detected: +0.2
    if (extracted.audience) score += 0.2;
    
    // Gap detected: +0.3
    if (extracted.gap) score += 0.3;

    // Implicit context from patterns: +0.2 max
    if (pattern.extractionMetadata) {
      score += Math.min(0.2, pattern.extractionMetadata.implicitContextScore);
    }

    return Math.min(1.0, score);
  }

  /**
   * Generate system prompt augmentation for anchored context
   */
  private generateSystemPromptAugmentation(anchor: ContextAnchor): string {
    const parts: string[] = [];

    parts.push('## Context Anchor (Cognitive Precision Protocol)');
    parts.push('');

    if (anchor.role) {
      parts.push(`**Your Role**: ${anchor.role}`);
    }

    if (anchor.audience) {
      parts.push(`**Target Audience**: ${anchor.audience}`);
    }

    if (anchor.gap) {
      parts.push(`**Gap to Bridge**: ${anchor.gap}`);
    }

    parts.push('');
    parts.push('Maintain this context throughout your response. Do not deviate from your assigned role or audience level.');

    return parts.join('\n');
  }

  /**
   * Create an empty anchor for skipped gates
   */
  private createEmptyAnchor(input: string, taskType: ContextAnchorTaskType = 'unknown'): ContextAnchor {
    return {
      role: null,
      audience: null,
      gap: null,
      confidence: 0,
      isAnchored: false,
      clarifyingQuestions: [],
      taskType,
      extractionMetadata: {
        sourceLength: input.length,
        keywordsFound: [],
        implicitContextScore: 0,
        explicitContextScore: 0,
      },
    };
  }

  /**
   * Get negative constraints for a task type
   */
  async getNegativeConstraints(
    tenantId: string,
    taskType: ContextAnchorTaskType
  ): Promise<ConstraintInjectionResult> {
    // Get tenant-specific constraints from database
    let tenantConstraints: NegativeConstraint[] = [];
    try {
      const result = await this.pool.query(
        `SELECT constraints FROM negative_constraints WHERE tenant_id = $1`,
        [tenantId]
      );
      if (result.rows.length > 0) {
        tenantConstraints = result.rows[0].constraints || [];
      }
    } catch {
      // Use defaults only
    }

    // Merge with defaults
    const allConstraints = [...DEFAULT_NEGATIVE_CONSTRAINTS, ...tenantConstraints];

    // Filter by task type
    const applicableConstraints = allConstraints.filter(
      c => c.appliesToTaskTypes.includes(taskType) || c.appliesToTaskTypes.includes('unknown')
    );

    // Generate constraint prompt
    const hardConstraints = applicableConstraints.filter(c => c.severity === 'hard');
    const softConstraints = applicableConstraints.filter(c => c.severity === 'soft');

    const parts: string[] = [];
    
    if (hardConstraints.length > 0) {
      parts.push('## Mandatory Constraints (MUST follow)');
      hardConstraints.forEach(c => parts.push(`- ${c.constraint}`));
      parts.push('');
    }

    if (softConstraints.length > 0) {
      parts.push('## Preferred Constraints (SHOULD follow)');
      softConstraints.forEach(c => parts.push(`- ${c.constraint}`));
    }

    // Count by category
    const constraintCounts: Record<string, number> = {};
    applicableConstraints.forEach(c => {
      constraintCounts[c.category] = (constraintCounts[c.category] || 0) + 1;
    });

    return {
      injectedConstraints: applicableConstraints,
      constraintPrompt: parts.join('\n'),
      constraintCounts,
    };
  }
}

export const contextAnchorService = {
  create: (deps: ContextAnchorServiceDeps) => new ContextAnchorService(deps),
};
