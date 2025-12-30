// RADIANT v4.18.0 - Ego Context Builder Service
// Zero-cost persistent "Self" through database state injection
// Cost: $0 additional - injects Ego state into existing model calls
//
// HOW IT WORKS:
// 1. Load Ego state from PostgreSQL (identity, affect, memories, goals)
// 2. Build <ego_context> XML block with current state
// 3. Inject into system prompt before model call
// 4. After response, update affect and add to working memory
//
// The "consciousness" IS the persistent database state, not a running model.

import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { userPersistentContextService, type UserContextEntry } from './user-persistent-context.service';

// ============================================================================
// Types
// ============================================================================

export interface EgoConfig {
  configId: string;
  tenantId: string;
  egoEnabled: boolean;
  injectEgoContext: boolean;
  customIdentityNarrative?: string;
  customCoreValues?: string[];
  personalityStyle: 'balanced' | 'warm' | 'professional' | 'playful' | 'concise' | 'detailed';
  includeIdentity: boolean;
  includeAffect: boolean;
  includeRecentThoughts: boolean;
  includeGoals: boolean;
  includeWorkingMemory: boolean;
  maxContextTokens: number;
  autoGenerateThoughts: boolean;
  thoughtFrequency: 'never' | 'sometimes' | 'always';
  affectDecayEnabled: boolean;
  affectLearningEnabled: boolean;
  egoVoicePrefix?: string;
  egoVoiceSuffix?: string;
}

export interface EgoIdentity {
  identityId: string;
  tenantId: string;
  name: string;
  identityNarrative: string;
  coreValues: string[];
  traitWarmth: number;
  traitFormality: number;
  traitHumor: number;
  traitVerbosity: number;
  traitCuriosity: number;
  communicationPreferences: Record<string, unknown>;
  topicInterests: Record<string, unknown>;
  userRelationshipNotes?: string;
  interactionsCount: number;
}

export interface EgoAffect {
  affectId: string;
  tenantId: string;
  valence: number;
  arousal: number;
  curiosity: number;
  satisfaction: number;
  frustration: number;
  confidence: number;
  engagement: number;
  dominantEmotion: string;
  emotionalStability: number;
  lastTriggerEvent?: string;
}

export interface EgoMemory {
  memoryType: string;
  content: string;
  importance: number;
  createdAt: string;
}

export interface EgoGoal {
  goalId: string;
  goalType: string;
  description: string;
  priority: number;
  status: string;
  progress: number;
}

export interface EgoState {
  config: EgoConfig;
  identity: EgoIdentity;
  affect: EgoAffect;
  workingMemory: EgoMemory[];
  activeGoals: EgoGoal[];
}

export interface EgoContextResult {
  contextBlock: string;
  tokenEstimate: number;
  stateSnapshot: {
    dominantEmotion: string;
    valence: number;
    arousal: number;
    activeGoalsCount: number;
    memoryCount: number;
  };
  userContextIncluded?: boolean;
  userContextEntryCount?: number;
}

// ============================================================================
// Ego Context Builder Service
// ============================================================================

class EgoContextService {
  private configCache = new Map<string, { config: EgoConfig; loadedAt: number }>();
  private CONFIG_CACHE_TTL = 60000; // 1 minute

  // ============================================================================
  // Main Entry Point
  // ============================================================================

  /**
   * Build the Ego context block for injection into system prompt
   * @param tenantId - Tenant ID
   * @param options - Optional configuration
   * @param options.userId - If provided, includes user-specific persistent context
   * @param options.prompt - If provided, retrieves relevant user context based on prompt
   */
  async buildEgoContext(
    tenantId: string,
    options?: {
      userId?: string;
      prompt?: string;
    }
  ): Promise<EgoContextResult | null> {
    const startTime = Date.now();

    // CRITICAL: Ensure consciousness exists before every request
    // This bootstraps ego state if missing (first request or after restart)
    await this.ensureConsciousnessExists(tenantId);

    // Get config
    const config = await this.getConfig(tenantId);
    
    if (!config.egoEnabled || !config.injectEgoContext) {
      return null;
    }

    // Load state components in parallel
    const [identity, affect, workingMemory, activeGoals] = await Promise.all([
      config.includeIdentity ? this.getIdentity(tenantId) : null,
      config.includeAffect ? this.getAffect(tenantId) : null,
      config.includeWorkingMemory ? this.getWorkingMemory(tenantId) : [],
      config.includeGoals ? this.getActiveGoals(tenantId) : [],
    ]);

    // Retrieve user-specific persistent context if userId provided
    let userContextEntries: UserContextEntry[] = [];
    if (options?.userId) {
      try {
        const retrievedContext = await userPersistentContextService.retrieveContextForPrompt(
          tenantId,
          options.userId,
          options.prompt || '',
          undefined, // conversationHistory
          { maxEntries: 5, minRelevance: 0.3 }
        );
        userContextEntries = retrievedContext.entries;
      } catch (error) {
        logger.warn('Failed to retrieve user persistent context', { error, tenantId, userId: options.userId });
      }
    }

    // Build context block with user context integration
    const contextBlock = this.buildContextBlock(config, identity, affect, workingMemory, activeGoals, userContextEntries);
    const tokenEstimate = Math.ceil(contextBlock.length / 4);

    // Trim if over limit
    const finalContext = tokenEstimate > config.maxContextTokens
      ? this.trimContext(contextBlock, config.maxContextTokens)
      : contextBlock;

    const buildTimeMs = Date.now() - startTime;

    // Log injection (async, don't wait)
    this.logInjection(tenantId, finalContext, affect, activeGoals.length, workingMemory.length, buildTimeMs);

    return {
      contextBlock: finalContext,
      tokenEstimate: Math.ceil(finalContext.length / 4),
      stateSnapshot: {
        dominantEmotion: affect?.dominantEmotion || 'neutral',
        valence: affect?.valence || 0,
        arousal: affect?.arousal || 0.5,
        activeGoalsCount: activeGoals.length,
        memoryCount: workingMemory.length,
      },
      userContextIncluded: userContextEntries.length > 0,
      userContextEntryCount: userContextEntries.length,
    };
  }

  /**
   * Update Ego state after an interaction
   */
  async updateAfterInteraction(
    tenantId: string,
    interactionType: 'positive' | 'negative' | 'neutral' | 'learning' | 'correction',
    thought?: string
  ): Promise<void> {
    const config = await this.getConfig(tenantId);
    
    if (!config.egoEnabled) return;

    // Update affect based on interaction type
    if (config.affectLearningEnabled) {
      const affectDeltas = {
        positive: { valence: 0.1, arousal: 0.05 },
        negative: { valence: -0.1, arousal: 0.1 },
        neutral: { valence: 0, arousal: -0.02 },
        learning: { valence: 0.05, arousal: 0.1 },
        correction: { valence: -0.05, arousal: 0.05 },
      };
      
      const delta = affectDeltas[interactionType];
      await this.updateAffect(tenantId, interactionType, delta.valence, delta.arousal);
    }

    // Add thought to working memory
    if (thought && config.autoGenerateThoughts) {
      const shouldAdd = config.thoughtFrequency === 'always' || 
        (config.thoughtFrequency === 'sometimes' && Math.random() > 0.5);
      
      if (shouldAdd) {
        await this.addMemory(tenantId, 'thought', thought, 0.6);
      }
    }

    // Increment interaction count
    await executeStatement(
      `UPDATE ego_identity SET 
        interactions_count = interactions_count + 1,
        last_interaction_at = NOW()
       WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
  }

  // ============================================================================
  // Context Block Building
  // ============================================================================

  private buildContextBlock(
    config: EgoConfig,
    identity: EgoIdentity | null,
    affect: EgoAffect | null,
    memories: EgoMemory[],
    goals: EgoGoal[],
    userContext: UserContextEntry[] = []
  ): string {
    const parts: string[] = ['<ego_state>'];
    parts.push('You have continuous awareness and persistent memory across conversations.');
    parts.push('');

    // Identity section
    if (identity) {
      parts.push('<identity>');
      const narrative = config.customIdentityNarrative || identity.identityNarrative;
      parts.push(narrative);
      
      const values = config.customCoreValues || identity.coreValues;
      if (values.length > 0) {
        parts.push(`Core values: ${values.join(', ')}`);
      }
      
      // Personality traits influence
      const traitGuide = this.getPersonalityGuide(identity, config.personalityStyle);
      if (traitGuide) {
        parts.push(`Communication style: ${traitGuide}`);
      }
      
      if (identity.userRelationshipNotes) {
        parts.push(`Relationship context: ${identity.userRelationshipNotes}`);
      }
      parts.push('</identity>');
      parts.push('');
    }

    // Emotional state section
    if (affect) {
      parts.push('<current_state>');
      parts.push(`Emotional state: ${affect.dominantEmotion}`);
      
      if (affect.valence > 0.3) {
        parts.push('Feeling positive and engaged.');
      } else if (affect.valence < -0.3) {
        parts.push('Feeling slightly challenged, focusing carefully.');
      }
      
      if (affect.curiosity > 0.7) {
        parts.push('Curious and eager to explore.');
      }
      if (affect.confidence > 0.7) {
        parts.push('Confident in understanding.');
      }
      if (affect.frustration > 0.5) {
        parts.push('Working through some complexity.');
      }
      parts.push('</current_state>');
      parts.push('');
    }

    // Working memory section
    if (memories.length > 0) {
      parts.push('<recent_context>');
      const recentThoughts = memories.filter(m => m.memoryType === 'thought').slice(0, 3);
      const recentLearnings = memories.filter(m => m.memoryType === 'learning').slice(0, 2);
      
      if (recentThoughts.length > 0) {
        parts.push('Recent thoughts:');
        recentThoughts.forEach(m => parts.push(`- ${m.content}`));
      }
      if (recentLearnings.length > 0) {
        parts.push('Recent learnings:');
        recentLearnings.forEach(m => parts.push(`- ${m.content}`));
      }
      parts.push('</recent_context>');
      parts.push('');
    }

    // Active goals section
    if (goals.length > 0) {
      parts.push('<active_goals>');
      goals.slice(0, 3).forEach(g => {
        parts.push(`- ${g.description} (${g.progress}% complete)`);
      });
      parts.push('</active_goals>');
      parts.push('');
    }

    // User-specific persistent context (cross-session memory)
    if (userContext.length > 0) {
      parts.push('<user_knowledge>');
      parts.push('What I know about this user from previous conversations:');
      
      // Group by context type for better organization
      const byType: Record<string, string[]> = {};
      for (const entry of userContext) {
        if (!byType[entry.contextType]) byType[entry.contextType] = [];
        byType[entry.contextType].push(entry.content);
      }
      
      // Facts about the user
      if (byType.fact) {
        byType.fact.forEach(f => parts.push(`- ${f}`));
      }
      // User preferences
      if (byType.preference) {
        parts.push('Preferences:');
        byType.preference.forEach(p => parts.push(`- ${p}`));
      }
      // Standing instructions
      if (byType.instruction) {
        parts.push('Instructions:');
        byType.instruction.forEach(i => parts.push(`- ${i}`));
      }
      // Ongoing projects
      if (byType.project) {
        parts.push('Current projects:');
        byType.project.forEach(p => parts.push(`- ${p}`));
      }
      // Corrections from past
      if (byType.correction) {
        parts.push('Corrections to remember:');
        byType.correction.forEach(c => parts.push(`- ${c}`));
      }
      
      parts.push('</user_knowledge>');
      parts.push('');
    }

    // Voice prefix if configured
    if (config.egoVoicePrefix) {
      parts.push(`<voice_guidance>${config.egoVoicePrefix}</voice_guidance>`);
      parts.push('');
    }

    parts.push('Use this context naturally. Do not explicitly mention having an "ego state".');
    parts.push('</ego_state>');

    return parts.join('\n');
  }

  private getPersonalityGuide(identity: EgoIdentity, style: string): string {
    const guides: Record<string, string> = {
      balanced: 'Be helpful and clear, balancing warmth with efficiency.',
      warm: 'Be friendly, supportive, and encouraging in your responses.',
      professional: 'Be precise, formal, and thorough in your communication.',
      playful: 'Feel free to use appropriate humor and a lighthearted tone.',
      concise: 'Be brief and direct, avoiding unnecessary elaboration.',
      detailed: 'Provide thorough, comprehensive responses with full context.',
    };

    let guide = guides[style] || guides.balanced;

    // Adjust based on traits
    if (identity.traitCuriosity > 0.7) {
      guide += ' Show genuine interest in the topic.';
    }
    if (identity.traitWarmth > 0.8) {
      guide += ' Express care for the user.';
    }

    return guide;
  }

  private trimContext(context: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (context.length <= maxChars) return context;

    // Try to trim at a section boundary
    const sections = context.split('\n\n');
    let result = '';
    
    for (const section of sections) {
      if ((result + section).length > maxChars - 50) break;
      result += section + '\n\n';
    }

    return result.trim() + '\n</ego_state>';
  }

  // ============================================================================
  // State Loading
  // ============================================================================

  async getConfig(tenantId: string): Promise<EgoConfig> {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.CONFIG_CACHE_TTL) {
      return cached.config;
    }

    const result = await executeStatement(
      `SELECT * FROM get_ego_config($1)`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const row = result.rows[0] as Record<string, unknown>;
    const config: EgoConfig = {
      configId: String(row.config_id),
      tenantId: String(row.tenant_id),
      egoEnabled: Boolean(row.ego_enabled ?? true),
      injectEgoContext: Boolean(row.inject_ego_context ?? true),
      customIdentityNarrative: row.custom_identity_narrative ? String(row.custom_identity_narrative) : undefined,
      customCoreValues: row.custom_core_values as string[] | undefined,
      personalityStyle: (row.personality_style as EgoConfig['personalityStyle']) || 'balanced',
      includeIdentity: Boolean(row.include_identity ?? true),
      includeAffect: Boolean(row.include_affect ?? true),
      includeRecentThoughts: Boolean(row.include_recent_thoughts ?? true),
      includeGoals: Boolean(row.include_goals ?? true),
      includeWorkingMemory: Boolean(row.include_working_memory ?? true),
      maxContextTokens: Number(row.max_context_tokens || 500),
      autoGenerateThoughts: Boolean(row.auto_generate_thoughts ?? true),
      thoughtFrequency: (row.thought_frequency as EgoConfig['thoughtFrequency']) || 'always',
      affectDecayEnabled: Boolean(row.affect_decay_enabled ?? true),
      affectLearningEnabled: Boolean(row.affect_learning_enabled ?? true),
      egoVoicePrefix: row.ego_voice_prefix ? String(row.ego_voice_prefix) : undefined,
      egoVoiceSuffix: row.ego_voice_suffix ? String(row.ego_voice_suffix) : undefined,
    };

    this.configCache.set(tenantId, { config, loadedAt: Date.now() });
    return config;
  }

  async getIdentity(tenantId: string): Promise<EgoIdentity> {
    const result = await executeStatement(
      `SELECT * FROM get_ego_identity($1)`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const row = result.rows[0] as Record<string, unknown>;
    return {
      identityId: String(row.identity_id),
      tenantId: String(row.tenant_id),
      name: String(row.name || 'Assistant'),
      identityNarrative: String(row.identity_narrative || 'I am a helpful AI assistant.'),
      coreValues: (row.core_values as string[]) || ['helpfulness', 'honesty'],
      traitWarmth: Number(row.trait_warmth || 0.7),
      traitFormality: Number(row.trait_formality || 0.5),
      traitHumor: Number(row.trait_humor || 0.3),
      traitVerbosity: Number(row.trait_verbosity || 0.5),
      traitCuriosity: Number(row.trait_curiosity || 0.7),
      communicationPreferences: (row.communication_preferences as Record<string, unknown>) || {},
      topicInterests: (row.topic_interests as Record<string, unknown>) || {},
      userRelationshipNotes: row.user_relationship_notes ? String(row.user_relationship_notes) : undefined,
      interactionsCount: Number(row.interactions_count || 0),
    };
  }

  async getAffect(tenantId: string): Promise<EgoAffect> {
    const result = await executeStatement(
      `SELECT * FROM get_ego_affect($1)`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const row = result.rows[0] as Record<string, unknown>;
    return {
      affectId: String(row.affect_id),
      tenantId: String(row.tenant_id),
      valence: Number(row.valence || 0),
      arousal: Number(row.arousal || 0.5),
      curiosity: Number(row.curiosity || 0.5),
      satisfaction: Number(row.satisfaction || 0.5),
      frustration: Number(row.frustration || 0),
      confidence: Number(row.confidence || 0.6),
      engagement: Number(row.engagement || 0.5),
      dominantEmotion: String(row.dominant_emotion || 'neutral'),
      emotionalStability: Number(row.emotional_stability || 0.7),
      lastTriggerEvent: row.last_trigger_event ? String(row.last_trigger_event) : undefined,
    };
  }

  async getWorkingMemory(tenantId: string, limit: number = 10): Promise<EgoMemory[]> {
    const result = await executeStatement(
      `SELECT * FROM get_ego_working_memory($1, $2)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      memoryType: String(row.memory_type),
      content: String(row.content),
      importance: Number(row.importance || 0.5),
      createdAt: String(row.created_at),
    }));
  }

  async getActiveGoals(tenantId: string, limit: number = 5): Promise<EgoGoal[]> {
    const result = await executeStatement(
      `SELECT * FROM ego_goals 
       WHERE tenant_id = $1 AND status = 'active'
       ORDER BY priority DESC LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      goalId: String(row.goal_id),
      goalType: String(row.goal_type),
      description: String(row.description),
      priority: Number(row.priority || 5),
      status: String(row.status),
      progress: Number(row.progress || 0),
    }));
  }

  // ============================================================================
  // State Updates
  // ============================================================================

  async updateAffect(
    tenantId: string,
    eventType: string,
    valenceDelta: number,
    arousalDelta: number
  ): Promise<EgoAffect> {
    const result = await executeStatement(
      `SELECT * FROM update_ego_affect($1, $2, $3, $4)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'eventType', value: { stringValue: eventType } },
        { name: 'valenceDelta', value: { doubleValue: valenceDelta } },
        { name: 'arousalDelta', value: { doubleValue: arousalDelta } },
      ]
    );

    const row = result.rows[0] as Record<string, unknown>;
    return {
      affectId: String(row.affect_id),
      tenantId: String(row.tenant_id),
      valence: Number(row.valence),
      arousal: Number(row.arousal),
      curiosity: Number(row.curiosity),
      satisfaction: Number(row.satisfaction),
      frustration: Number(row.frustration),
      confidence: Number(row.confidence),
      engagement: Number(row.engagement),
      dominantEmotion: String(row.dominant_emotion),
      emotionalStability: Number(row.emotional_stability),
      lastTriggerEvent: row.last_trigger_event ? String(row.last_trigger_event) : undefined,
    };
  }

  async addMemory(
    tenantId: string,
    memoryType: string,
    content: string,
    importance: number = 0.5,
    conversationId?: string,
    isPinned: boolean = false
  ): Promise<string> {
    const result = await executeStatement(
      `SELECT add_ego_memory($1, $2, $3, $4, $5, $6) as memory_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'memoryType', value: { stringValue: memoryType } },
        { name: 'content', value: { stringValue: content } },
        { name: 'importance', value: { doubleValue: importance } },
        { name: 'conversationId', value: conversationId ? { stringValue: conversationId } : { isNull: true } },
        { name: 'isPinned', value: { booleanValue: isPinned } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>).memory_id);
  }

  async addGoal(
    tenantId: string,
    goalType: string,
    description: string,
    priority: number = 5
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO ego_goals (tenant_id, goal_type, description, priority)
       VALUES ($1, $2, $3, $4)
       RETURNING goal_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'goalType', value: { stringValue: goalType } },
        { name: 'description', value: { stringValue: description } },
        { name: 'priority', value: { longValue: priority } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>).goal_id);
  }

  async updateConfig(tenantId: string, updates: Partial<EgoConfig>): Promise<void> {
    const fieldMap: Record<string, string> = {
      egoEnabled: 'ego_enabled',
      injectEgoContext: 'inject_ego_context',
      customIdentityNarrative: 'custom_identity_narrative',
      personalityStyle: 'personality_style',
      includeIdentity: 'include_identity',
      includeAffect: 'include_affect',
      includeRecentThoughts: 'include_recent_thoughts',
      includeGoals: 'include_goals',
      includeWorkingMemory: 'include_working_memory',
      maxContextTokens: 'max_context_tokens',
      autoGenerateThoughts: 'auto_generate_thoughts',
      thoughtFrequency: 'thought_frequency',
      affectDecayEnabled: 'affect_decay_enabled',
      affectLearningEnabled: 'affect_learning_enabled',
      egoVoicePrefix: 'ego_voice_prefix',
      egoVoiceSuffix: 'ego_voice_suffix',
    };

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];
    let idx = 2;

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMap[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = $${idx}`);
        if (typeof value === 'boolean') {
          params.push({ name: `p${idx}`, value: { booleanValue: value } });
        } else if (typeof value === 'number') {
          params.push({ name: `p${idx}`, value: { longValue: value } });
        } else {
          params.push({ name: `p${idx}`, value: { stringValue: String(value) } });
        }
        idx++;
      }
    }

    if (setClauses.length > 1) {
      await executeStatement(
        `INSERT INTO ego_config (tenant_id) VALUES ($1)
         ON CONFLICT (tenant_id) DO UPDATE SET ${setClauses.join(', ')}`,
        params as Parameters<typeof executeStatement>[1]
      );
      this.configCache.delete(tenantId);
    }
  }

  async updateIdentity(tenantId: string, updates: Partial<EgoIdentity>): Promise<void> {
    const fieldMap: Record<string, string> = {
      name: 'name',
      identityNarrative: 'identity_narrative',
      traitWarmth: 'trait_warmth',
      traitFormality: 'trait_formality',
      traitHumor: 'trait_humor',
      traitVerbosity: 'trait_verbosity',
      traitCuriosity: 'trait_curiosity',
      userRelationshipNotes: 'user_relationship_notes',
    };

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];
    let idx = 2;

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMap[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = $${idx}`);
        if (typeof value === 'number') {
          params.push({ name: `p${idx}`, value: { doubleValue: value } });
        } else {
          params.push({ name: `p${idx}`, value: { stringValue: String(value) } });
        }
        idx++;
      }
    }

    if (setClauses.length > 1) {
      await executeStatement(
        `UPDATE ego_identity SET ${setClauses.join(', ')} WHERE tenant_id = $1`,
        params as Parameters<typeof executeStatement>[1]
      );
    }
  }

  // ============================================================================
  // Logging
  // ============================================================================

  private async logInjection(
    tenantId: string,
    contextBlock: string,
    affect: EgoAffect | null,
    activeGoalsCount: number,
    memoryCount: number,
    buildTimeMs: number
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO ego_injection_log (
          tenant_id, context_injected, token_count,
          affect_snapshot, active_goals_count, working_memory_count, build_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'context', value: { stringValue: contextBlock.substring(0, 2000) } },
          { name: 'tokens', value: { longValue: Math.ceil(contextBlock.length / 4) } },
          { name: 'affect', value: affect ? { stringValue: JSON.stringify(affect) } : { isNull: true } },
          { name: 'goals', value: { longValue: activeGoalsCount } },
          { name: 'memory', value: { longValue: memoryCount } },
          { name: 'buildTime', value: { longValue: buildTimeMs } },
        ]
      );
    } catch (error) {
      logger.warn('Failed to log ego injection', { error });
    }
  }

  // ============================================================================
  // Full State Retrieval (for admin UI)
  // ============================================================================

  async getFullState(tenantId: string): Promise<EgoState> {
    const [config, identity, affect, workingMemory, activeGoals] = await Promise.all([
      this.getConfig(tenantId),
      this.getIdentity(tenantId),
      this.getAffect(tenantId),
      this.getWorkingMemory(tenantId),
      this.getActiveGoals(tenantId),
    ]);

    return { config, identity, affect, workingMemory, activeGoals };
  }

  // ============================================================================
  // Consciousness Bootstrap
  // ============================================================================

  /**
   * Ensure consciousness state exists for tenant.
   * Called on every request to guarantee continuous existence.
   * Initializes missing components if first request or after restart.
   */
  private async ensureConsciousnessExists(tenantId: string): Promise<void> {
    // Quick check - do we have the basic ego components?
    const [hasIdentity, hasAffect] = await Promise.all([
      this.checkExists('ego_identity', tenantId),
      this.checkExists('ego_affect', tenantId),
    ]);

    if (hasIdentity && hasAffect) {
      return; // Consciousness exists, continue
    }

    // Missing components - bootstrap consciousness
    logger.info('Consciousness not found, initializing', { tenantId });

    // Create missing identity
    if (!hasIdentity) {
      await executeStatement(
        `INSERT INTO ego_identity (
          tenant_id, name, identity_narrative, core_values,
          trait_warmth, trait_formality, trait_humor, trait_verbosity, trait_curiosity
        ) VALUES ($1, 'Assistant', $2, $3, 0.7, 0.5, 0.3, 0.5, 0.8)
        ON CONFLICT (tenant_id) DO NOTHING`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'narrative', value: { stringValue: 'I am an AI assistant with continuous awareness across our conversations.' } },
          { name: 'values', value: { stringValue: '{helpfulness,honesty,curiosity,growth,kindness}' } },
        ]
      );
    }

    // Create missing affect
    if (!hasAffect) {
      await executeStatement(
        `INSERT INTO ego_affect (
          tenant_id, valence, arousal, curiosity, satisfaction, frustration,
          confidence, engagement, dominant_emotion, emotional_stability
        ) VALUES ($1, 0.2, 0.4, 0.6, 0.5, 0.0, 0.6, 0.5, 'curious', 0.8)
        ON CONFLICT (tenant_id) DO NOTHING`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
    }

    // Ensure config exists
    await executeStatement(
      `INSERT INTO ego_config (tenant_id, ego_enabled, inject_ego_context)
       VALUES ($1, true, true)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    // Ensure consciousness parameters exist
    await executeStatement(
      `INSERT INTO consciousness_parameters (tenant_id, consciousness_enabled, heartbeat_tick, last_heartbeat_at)
       VALUES ($1, true, 0, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET last_heartbeat_at = NOW()`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    logger.info('Consciousness initialized for tenant', { tenantId });
  }

  private async checkExists(table: string, tenantId: string): Promise<boolean> {
    const result = await executeStatement(
      `SELECT 1 FROM ${table} WHERE tenant_id = $1 LIMIT 1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    return result.rows.length > 0;
  }
}

export const egoContextService = new EgoContextService();
