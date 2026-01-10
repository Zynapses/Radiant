// AGI Brain/Ideas Service
// Real-time prompt suggestions and result ideas generation

import { executeStatement, stringParam } from '../db/client';
import type {
  PromptSuggestion,
  TypeaheadRequest,
  TypeaheadResponse,
  ResultIdea,
  ResultIdeasSection,
  SuggestionType,
  SuggestionSource,
  IdeaCategory,
  AGIIdeasConfig,
  PROMPT_PATTERNS,
} from '@radiant/shared';
import crypto from 'crypto';

const DEFAULT_CONFIG: AGIIdeasConfig = {
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

// Common prompt patterns for fast matching
const PATTERNS: Record<string, { regex: RegExp; suggestions: string[] }> = {
  howTo: { regex: /^how (do|can|to|would)/i, suggestions: ['step by step', 'with examples', 'for beginners', 'best practices'] },
  explain: { regex: /^(explain|what is|what are|describe)/i, suggestions: ['in simple terms', 'with analogies', 'the key concepts', 'pros and cons'] },
  compare: { regex: /^(compare|difference|versus|vs)/i, suggestions: ['with a table', 'key differences', 'which is better for', 'trade-offs'] },
  code: { regex: /^(write|create|build|implement|code)/i, suggestions: ['with error handling', 'with tests', 'with documentation', 'production-ready'] },
  analyze: { regex: /^(analyze|review|evaluate|assess)/i, suggestions: ['strengths and weaknesses', 'with recommendations', 'risk assessment', 'detailed breakdown'] },
  summarize: { regex: /^(summarize|summary|tldr|brief)/i, suggestions: ['key points', 'in bullet points', 'executive summary', 'one paragraph'] },
  debug: { regex: /^(debug|fix|error|issue|problem)/i, suggestions: ['with explanation', 'step by step', 'root cause', 'prevention tips'] },
};

class AGIIdeasService {
  private config: AGIIdeasConfig = DEFAULT_CONFIG;

  /**
   * Generate typeahead suggestions as user types
   */
  async getTypeaheadSuggestions(request: TypeaheadRequest): Promise<TypeaheadResponse> {
    const startTime = Date.now();
    const suggestions: PromptSuggestion[] = [];

    if (!this.config.typeahead.enabled) {
      return { suggestions: [], processingTimeMs: 0 };
    }

    if (request.partialPrompt.length < this.config.typeahead.minCharsToTrigger) {
      return { suggestions: [], processingTimeMs: 0 };
    }

    const includeSources = request.includeTypes 
      ? this.config.typeahead.includeSources 
      : this.config.typeahead.includeSources;

    // 1. Pattern-based suggestions (fast, local)
    if (includeSources.includes('pattern_match')) {
      const patternSuggestions = this.getPatternSuggestions(request.partialPrompt);
      suggestions.push(...patternSuggestions);
    }

    // 2. User history-based suggestions
    if (includeSources.includes('user_history')) {
      const historySuggestions = await this.getHistorySuggestions(
        request.userId,
        request.partialPrompt
      );
      suggestions.push(...historySuggestions);
    }

    // 3. Domain-aware suggestions
    if (includeSources.includes('domain_aware') && request.domainHint) {
      const domainSuggestions = await this.getDomainSuggestions(
        request.partialPrompt,
        request.domainHint
      );
      suggestions.push(...domainSuggestions);
    }

    // 4. Trending suggestions
    if (includeSources.includes('trending')) {
      const trendingSuggestions = await this.getTrendingSuggestions(request.domainHint);
      suggestions.push(...trendingSuggestions);
    }

    // Sort by relevance and limit
    const sortedSuggestions = suggestions
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, request.maxSuggestions || this.config.typeahead.maxSuggestions);

    // Log for learning
    await this.logSuggestions(request, sortedSuggestions);

    return {
      suggestions: sortedSuggestions,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get pattern-based suggestions (fast, no DB)
   */
  private getPatternSuggestions(partialPrompt: string): PromptSuggestion[] {
    const suggestions: PromptSuggestion[] = [];
    const lowerPrompt = partialPrompt.toLowerCase().trim();

    for (const [patternName, { regex, suggestions: patternSuggestions }] of Object.entries(PATTERNS)) {
      if (regex.test(lowerPrompt)) {
        for (const suggestion of patternSuggestions) {
          // Only suggest if not already in prompt
          if (!lowerPrompt.includes(suggestion.toLowerCase())) {
            suggestions.push({
              id: crypto.randomUUID(),
              text: `${partialPrompt} ${suggestion}`,
              type: 'completion',
              source: 'pattern_match',
              confidence: 0.85,
              relevanceScore: 0.8,
              metadata: {
                basedOnPattern: patternName,
              },
            });
          }
        }
        break; // Only match first pattern
      }
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Get suggestions based on user's prompt history
   */
  private async getHistorySuggestions(
    userId: string,
    partialPrompt: string
  ): Promise<PromptSuggestion[]> {
    try {
      const result = await executeStatement(`
          SELECT prompt_text, domain_id, response_rating
          FROM user_prompt_history
          WHERE user_id = $1::uuid
            AND prompt_text ILIKE $2 || '%'
            AND response_rating >= 4
          ORDER BY created_at DESC
          LIMIT 3
        `, [
          stringParam('userId', userId),
          stringParam('partial', partialPrompt),
        ]);

      return (result.rows || []).map(row => ({
        id: crypto.randomUUID(),
        text: row.prompt_text as string,
        type: 'refinement' as SuggestionType,
        source: 'user_history' as SuggestionSource,
        confidence: 0.75,
        relevanceScore: 0.7,
        metadata: {
          domainId: row.domain_id as string,
        },
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get domain-specific suggestions
   */
  private async getDomainSuggestions(
    partialPrompt: string,
    domainHint: string
  ): Promise<PromptSuggestion[]> {
    // Domain-specific prompt templates
    const domainTemplates: Record<string, string[]> = {
      coding: ['with TypeScript types', 'following best practices', 'with unit tests'],
      research: ['with citations', 'peer-reviewed sources', 'recent studies'],
      medical: ['evidence-based', 'clinical guidelines', 'differential diagnosis'],
      legal: ['jurisdiction-specific', 'case law references', 'statutory basis'],
      financial: ['with risk analysis', 'regulatory compliance', 'market data'],
    };

    const templates = domainTemplates[domainHint.toLowerCase()] || [];
    
    return templates.map(template => ({
      id: crypto.randomUUID(),
      text: `${partialPrompt} ${template}`,
      type: 'refinement' as SuggestionType,
      source: 'domain_aware' as SuggestionSource,
      confidence: 0.7,
      relevanceScore: 0.65,
      metadata: {
        domainName: domainHint,
        domainSpecific: true,
      },
    })).slice(0, 2);
  }

  /**
   * Get trending prompt suggestions
   */
  private async getTrendingSuggestions(domainHint?: string): Promise<PromptSuggestion[]> {
    try {
      const result = await executeStatement(`
          SELECT prompt_template, domain_name, usage_count
          FROM trending_prompts
          WHERE is_active = true
            ${domainHint ? 'AND domain_name ILIKE $1' : ''}
          ORDER BY usage_count DESC
          LIMIT 2
        `, domainHint ? [stringParam('domain', `%${domainHint}%`)] : []);

      return (result.rows || []).map(row => ({
        id: crypto.randomUUID(),
        text: row.prompt_template as string,
        type: 'alternative' as SuggestionType,
        source: 'trending' as SuggestionSource,
        confidence: 0.6,
        relevanceScore: 0.5,
        metadata: {
          domainName: row.domain_name as string,
        },
      }));
    } catch {
      return [];
    }
  }

  /**
   * Generate ideas to show with response
   */
  async generateResultIdeas(
    responseText: string,
    promptText: string,
    orchestrationMode: string,
    userId: string,
    tenantId: string,
    options: {
      domainId?: string;
      maxIdeas?: number;
      planId?: string;
    } = {}
  ): Promise<ResultIdeasSection> {
    const startTime = Date.now();

    if (!this.config.resultIdeas.enabled) {
      return { ideas: [], totalGenerated: 0, filteredCount: 0, generationTimeMs: 0 };
    }

    // Check if mode should show ideas
    if (!this.config.resultIdeas.showInModes.includes(orchestrationMode)) {
      return { ideas: [], totalGenerated: 0, filteredCount: 0, generationTimeMs: 0 };
    }

    const ideas: ResultIdea[] = [];
    const maxIdeas = options.maxIdeas || this.config.resultIdeas.maxIdeas;

    // 1. Extract key topics from response
    const topics = this.extractTopics(responseText);

    // 2. Generate "Explore Further" ideas
    if (this.config.resultIdeas.categories.includes('explore_further')) {
      const exploreideas = this.generateExploreIdeas(topics, promptText);
      ideas.push(...exploreideas);
    }

    // 3. Generate "Related Topics" ideas
    if (this.config.resultIdeas.categories.includes('related_topic')) {
      const relatedIdeas = this.generateRelatedIdeas(topics, promptText);
      ideas.push(...relatedIdeas);
    }

    // 4. Generate "Practical Next Steps" ideas
    if (this.config.resultIdeas.categories.includes('practical_next')) {
      const practicalIdeas = this.generatePracticalIdeas(responseText, promptText);
      ideas.push(...practicalIdeas);
    }

    // Filter by confidence and sort by priority
    const filteredIdeas = ideas
      .filter(idea => idea.confidence >= this.config.resultIdeas.minConfidence)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxIdeas);

    // Store ideas for learning
    await this.storeResultIdeas(filteredIdeas, userId, tenantId, options.planId);

    return {
      ideas: filteredIdeas,
      totalGenerated: ideas.length,
      filteredCount: ideas.length - filteredIdeas.length,
      generationTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Extract key topics from response text
   */
  private extractTopics(text: string): string[] {
    // Simple extraction: find capitalized phrases and technical terms
    const topics: string[] = [];
    
    // Find quoted terms
    const quoted = text.match(/"([^"]+)"/g) || [];
    topics.push(...quoted.map(q => q.replace(/"/g, '')));

    // Find code-like terms (camelCase, snake_case)
    const codeTerms = text.match(/\b[a-z]+(?:[A-Z][a-z]+)+\b|\b[a-z]+(?:_[a-z]+)+\b/g) || [];
    topics.push(...codeTerms);

    // Find capitalized multi-word phrases
    const capitalPhrases = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];
    topics.push(...capitalPhrases);

    return [...new Set(topics)].slice(0, 5);
  }

  /**
   * Generate "Explore Further" ideas
   */
  private generateExploreIdeas(topics: string[], originalPrompt: string): ResultIdea[] {
    return topics.slice(0, 2).map((topic, i) => ({
      id: crypto.randomUUID(),
      category: 'explore_further' as IdeaCategory,
      title: `Deep dive: ${topic}`,
      description: `Learn more about ${topic} and its implications`,
      suggestedPrompt: `Explain ${topic} in more detail, including advanced concepts and practical applications`,
      confidence: 0.75 - (i * 0.05),
      priority: 8 - i,
    }));
  }

  /**
   * Generate "Related Topics" ideas
   */
  private generateRelatedIdeas(topics: string[], originalPrompt: string): ResultIdea[] {
    const relatedPhrases = [
      'alternatives to',
      'history of',
      'future of',
      'best practices for',
      'common mistakes with',
    ];

    return topics.slice(0, 2).map((topic, i) => ({
      id: crypto.randomUUID(),
      category: 'related_topic' as IdeaCategory,
      title: `${relatedPhrases[i % relatedPhrases.length]} ${topic}`,
      description: `Explore related aspects of ${topic}`,
      suggestedPrompt: `What are the ${relatedPhrases[i % relatedPhrases.length]} ${topic}?`,
      confidence: 0.7 - (i * 0.05),
      priority: 7 - i,
    }));
  }

  /**
   * Generate "Practical Next Steps" ideas
   */
  private generatePracticalIdeas(responseText: string, originalPrompt: string): ResultIdea[] {
    const ideas: ResultIdea[] = [];

    // If response contains code, suggest testing/implementation
    if (responseText.includes('```')) {
      ideas.push({
        id: crypto.randomUUID(),
        category: 'practical_next' as IdeaCategory,
        title: 'Test this implementation',
        description: 'Generate test cases to verify the code works correctly',
        suggestedPrompt: 'Write comprehensive unit tests for the code above',
        confidence: 0.8,
        priority: 9,
      });
    }

    // If response is explanatory, suggest application
    if (originalPrompt.toLowerCase().includes('explain') || originalPrompt.toLowerCase().includes('what is')) {
      ideas.push({
        id: crypto.randomUUID(),
        category: 'practical_next' as IdeaCategory,
        title: 'Apply this knowledge',
        description: 'See how to use this in a real-world scenario',
        suggestedPrompt: `Give me a practical example of applying ${originalPrompt.slice(0, 50)}...`,
        confidence: 0.75,
        priority: 8,
      });
    }

    return ideas;
  }

  /**
   * Log suggestions for learning
   */
  private async logSuggestions(
    request: TypeaheadRequest,
    suggestions: PromptSuggestion[]
  ): Promise<void> {
    try {
      const sourceBreakdown: Record<string, number> = {};
      for (const s of suggestions) {
        sourceBreakdown[s.source] = (sourceBreakdown[s.source] || 0) + 1;
      }

      await executeStatement(`
          INSERT INTO suggestion_log (
            tenant_id, user_id, partial_prompt, cursor_position,
            suggestions, suggestion_count, source_breakdown
          ) VALUES (
            current_setting('app.current_tenant_id')::uuid,
            $1::uuid, $2, $3, $4::jsonb, $5, $6::jsonb
          )
        `, [
          stringParam('userId', request.userId),
          stringParam('partial', request.partialPrompt),
          stringParam('cursor', String(request.cursorPosition)),
          stringParam('suggestions', JSON.stringify(suggestions)),
          stringParam('count', String(suggestions.length)),
          stringParam('breakdown', JSON.stringify(sourceBreakdown)),
        ]);
    } catch {
      // Non-critical, don't fail
    }
  }

  /**
   * Store result ideas for learning
   */
  private async storeResultIdeas(
    ideas: ResultIdea[],
    userId: string,
    tenantId: string,
    planId?: string
  ): Promise<void> {
    try {
      for (const idea of ideas) {
        await executeStatement(`
            INSERT INTO result_ideas (
              tenant_id, user_id, plan_id,
              category, title, description, suggested_prompt,
              confidence, priority
            ) VALUES (
              $1::uuid, $2::uuid, $3::uuid,
              $4, $5, $6, $7, $8, $9
            )
          `, [
            stringParam('tenantId', tenantId),
            stringParam('userId', userId),
            stringParam('planId', planId || ''),
            stringParam('category', idea.category),
            stringParam('title', idea.title),
            stringParam('description', idea.description),
            stringParam('suggestedPrompt', idea.suggestedPrompt || ''),
            stringParam('confidence', String(idea.confidence)),
            stringParam('priority', String(idea.priority)),
          ]);
      }
    } catch {
      // Non-critical
    }
  }

  /**
   * Record user selection of a suggestion
   */
  async recordSuggestionSelection(logId: string, selectedId: string): Promise<void> {
    await executeStatement(`SELECT record_suggestion_selection($1::uuid, $2)`, [
        stringParam('logId', logId),
        stringParam('selectedId', selectedId),
      ]);
  }

  /**
   * Record user click on a result idea
   */
  async recordIdeaClick(ideaId: string): Promise<void> {
    await executeStatement(`SELECT record_idea_click($1::uuid)`, [stringParam('ideaId', ideaId)]);
  }

  /**
   * Record prompt to user history
   */
  async recordPromptHistory(
    tenantId: string,
    userId: string,
    promptText: string,
    domainId?: string,
    orchestrationMode?: string
  ): Promise<void> {
    const promptHash = crypto.createHash('sha256').update(promptText).digest('hex').slice(0, 16);

    try {
      await executeStatement(`
          INSERT INTO user_prompt_history (
            tenant_id, user_id, prompt_text, prompt_hash,
            domain_id, orchestration_mode
          ) VALUES (
            $1::uuid, $2::uuid, $3, $4, $5::uuid, $6
          )
          ON CONFLICT DO NOTHING
        `, [
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          stringParam('promptText', promptText),
          stringParam('promptHash', promptHash),
          stringParam('domainId', domainId || ''),
          stringParam('orchestrationMode', orchestrationMode || ''),
        ]);
    } catch {
      // Non-critical
    }
  }

  setConfig(config: Partial<AGIIdeasConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      typeahead: { ...this.config.typeahead, ...config.typeahead },
      resultIdeas: { ...this.config.resultIdeas, ...config.resultIdeas },
      proactive: { ...this.config.proactive, ...config.proactive },
    };
  }

  getConfig(): AGIIdeasConfig {
    return { ...this.config };
  }
}

export const agiIdeasService = new AGIIdeasService();
