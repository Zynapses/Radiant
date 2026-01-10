/**
 * RADIANT v4.18.0 - Think Tank Delight Service
 * Personality, humor, and delightful feedback for AI orchestration
 */

import { executeStatement, stringParam, longParam } from '../db/client';
import { enhancedLogger } from '../logging/enhanced-logger';

// Import types from @radiant/shared - single source of truth
import type {
  InjectionPoint,
  TriggerType,
  DisplayStyle,
  PersonalityMode,
  AchievementType,
  AchievementRarity,
  EasterEggTriggerType,
  EasterEggEffectType,
  SoundTheme,
  TimeContext,
  DelightCategory,
  DelightMessage,
  DelightAchievement,
  UserAchievement,
  UserDelightPreferences,
  DelightEasterEgg,
  DelightSound,
} from '@radiant/shared';

// Re-export types for consumers of this service
export type {
  InjectionPoint,
  TriggerType,
  DisplayStyle,
  PersonalityMode,
  AchievementType,
  AchievementRarity,
  EasterEggTriggerType,
  EasterEggEffectType,
  SoundTheme,
  TimeContext,
  DelightCategory,
  DelightMessage,
  DelightAchievement,
  UserAchievement,
  UserDelightPreferences,
  DelightEasterEgg,
  DelightSound,
};

const logger = enhancedLogger;

// ============================================================================
// Service-specific Types (not in @radiant/shared)
// ============================================================================

export interface DelightMessageResponse {
  message: DelightMessage | null;
  sound?: DelightSound | null;
  selectedText: string;
}

export interface OrchestrationDelightContext {
  sessionId: string;
  currentPhase: InjectionPoint;
  domainInfo: {
    currentDomain: string | null;
    previousDomain?: string | null;
    isDomainSwitch: boolean;
  };
  modelInfo?: {
    activeModels: string[];
    consensusLevel: 'strong' | 'moderate' | 'divergent';
    leadingModel: string | null;
  };
  timeInfo: {
    sessionDurationMinutes: number;
    timeOfDay: TimeContext;
    isWeekend?: boolean;
  };
  queryInfo: {
    complexity: 'simple' | 'moderate' | 'complex';
    isMultiPart?: boolean;
    isNovel?: boolean;
  };
}

// ============================================================================
// Service Implementation
// ============================================================================

class DelightService {
  private messageCache: Map<string, { messages: DelightMessage[]; cachedAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 60000;

  // ============================================================================
  // Message Selection
  // ============================================================================

  async getDelightMessage(
    injectionPoint: InjectionPoint,
    triggerType: TriggerType,
    userId: string,
    tenantId: string,
    options?: { domainFamily?: string; timeContext?: TimeContext }
  ): Promise<DelightMessageResponse> {
    try {
      const prefs = await this.getUserPreferences(userId, tenantId);
      
      if (!this.isMessageTypeEnabled(triggerType, prefs)) {
        return { message: null, selectedText: '' };
      }

      const cacheKey = `${injectionPoint}:${triggerType}`;
      let messages = this.getCachedMessages(cacheKey);

      if (!messages) {
        const result = await executeStatement<DelightMessage>(`
          SELECT dm.id, dm.category_id as "categoryId", dm.injection_point as "injectionPoint",
                 dm.trigger_type as "triggerType", dm.message_text as "messageText",
                 dm.message_alt_texts as "messageAltTexts", dm.domain_families as "domainFamilies",
                 dm.time_contexts as "timeContexts", dm.display_style as "displayStyle",
                 dm.sound_effect as "soundEffect", dm.priority, dm.is_enabled as "isEnabled",
                 dm.requires_opt_in as "requiresOptIn"
          FROM delight_messages dm
          JOIN delight_categories dc ON dm.category_id = dc.id
          WHERE dm.is_enabled = TRUE AND dc.is_enabled = TRUE
            AND dm.injection_point = :injection_point
            AND dm.trigger_type = :trigger_type
          ORDER BY dm.priority DESC
        `, [
          stringParam('injection_point', injectionPoint),
          stringParam('trigger_type', triggerType),
        ]);
        
        messages = result.rows;
        this.cacheMessages(cacheKey, messages);
      }

      const filteredMessages = this.filterMessages(messages, prefs, options);
      
      if (filteredMessages.length === 0) {
        return { message: null, selectedText: '' };
      }

      const selectedMessage = this.selectMessage(filteredMessages);
      const selectedText = this.selectMessageText(selectedMessage);

      let sound: DelightSound | null = null;
      if (selectedMessage.soundEffect && prefs.enableSounds) {
        sound = await this.getSound(selectedMessage.soundEffect, prefs.soundTheme);
      }

      await this.logDelightEvent(userId, tenantId, 'message_shown', selectedMessage.id);

      return { message: selectedMessage, sound, selectedText };
    } catch (error) {
      logger.error('Failed to get delight message', { error });
      return { message: null, selectedText: '' };
    }
  }

  async getMessagesForOrchestration(
    context: OrchestrationDelightContext,
    userId: string,
    tenantId: string
  ): Promise<DelightMessageResponse[]> {
    const responses: DelightMessageResponse[] = [];
    
    try {
      const prefs = await this.getUserPreferences(userId, tenantId);
      
      if (context.currentPhase === 'pre_execution') {
        if (prefs.enableDomainMessages && context.domainInfo.currentDomain) {
          const msg = await this.getDelightMessage(
            'pre_execution', 'domain_loading', userId, tenantId,
            { domainFamily: context.domainInfo.currentDomain }
          );
          if (msg.message) responses.push(msg);
        }

        if (prefs.enableDomainMessages && context.domainInfo.isDomainSwitch) {
          const msg = await this.getDelightMessage('pre_execution', 'domain_transition', userId, tenantId);
          if (msg.message) responses.push(msg);
        }

        if (prefs.enableTimeAwareness) {
          const msg = await this.getDelightMessage(
            'pre_execution', 'time_aware', userId, tenantId,
            { timeContext: context.timeInfo.timeOfDay }
          );
          if (msg.message) responses.push(msg);
        }
      }

      if (context.currentPhase === 'during_execution') {
        if (prefs.enableModelPersonality) {
          const msg = await this.getDelightMessage('during_execution', 'model_dynamics', userId, tenantId);
          if (msg.message) responses.push(msg);
        }

        if (context.queryInfo.complexity !== 'simple') {
          const msg = await this.getDelightMessage('during_execution', 'complexity_signals', userId, tenantId);
          if (msg.message) responses.push(msg);
        }
      }

      if (context.currentPhase === 'post_execution') {
        if (prefs.enableModelPersonality) {
          const msg = await this.getDelightMessage('post_execution', 'synthesis_quality', userId, tenantId);
          if (msg.message) responses.push(msg);
        }

        if (prefs.enableWellbeingNudges && context.timeInfo.sessionDurationMinutes > 60) {
          const msg = await this.getDelightMessage('post_execution', 'wellbeing', userId, tenantId);
          if (msg.message) responses.push(msg);
        }
      }

      return responses;
    } catch (error) {
      logger.error('Failed to get orchestration delight messages', { error });
      return [];
    }
  }

  // ============================================================================
  // User Preferences
  // ============================================================================

  async getUserPreferences(userId: string, tenantId: string): Promise<UserDelightPreferences> {
    try {
      const result = await executeStatement<Record<string, unknown>>(`
        SELECT user_id, tenant_id, personality_mode, intensity_level,
               enable_domain_messages, enable_model_personality, enable_time_awareness,
               enable_achievements, enable_wellbeing_nudges, enable_easter_eggs,
               enable_sounds, sound_theme, sound_volume
        FROM user_delight_preferences
        WHERE user_id = :user_id AND tenant_id = :tenant_id
      `, [stringParam('user_id', userId), stringParam('tenant_id', tenantId)]);

      if (result.rows.length > 0) {
        return this.mapRowToPreferences(result.rows[0]);
      }

      return this.getDefaultPreferences(userId, tenantId);
    } catch (error) {
      logger.error('Failed to get user delight preferences', { error });
      return this.getDefaultPreferences(userId, tenantId);
    }
  }

  async updateUserPreferences(
    userId: string,
    tenantId: string,
    updates: Partial<UserDelightPreferences>
  ): Promise<UserDelightPreferences> {
    try {
      await executeStatement(`
        INSERT INTO user_delight_preferences (
          user_id, tenant_id, personality_mode, intensity_level,
          enable_domain_messages, enable_model_personality, enable_time_awareness,
          enable_achievements, enable_wellbeing_nudges, enable_easter_eggs,
          enable_sounds, sound_theme, sound_volume
        ) VALUES (:user_id, :tenant_id, :personality_mode, :intensity_level,
          :enable_domain_messages, :enable_model_personality, :enable_time_awareness,
          :enable_achievements, :enable_wellbeing_nudges, :enable_easter_eggs,
          :enable_sounds, :sound_theme, :sound_volume)
        ON CONFLICT (user_id, tenant_id) DO UPDATE SET
          personality_mode = COALESCE(EXCLUDED.personality_mode, user_delight_preferences.personality_mode),
          intensity_level = COALESCE(EXCLUDED.intensity_level, user_delight_preferences.intensity_level),
          enable_domain_messages = COALESCE(EXCLUDED.enable_domain_messages, user_delight_preferences.enable_domain_messages),
          enable_model_personality = COALESCE(EXCLUDED.enable_model_personality, user_delight_preferences.enable_model_personality),
          enable_time_awareness = COALESCE(EXCLUDED.enable_time_awareness, user_delight_preferences.enable_time_awareness),
          enable_achievements = COALESCE(EXCLUDED.enable_achievements, user_delight_preferences.enable_achievements),
          enable_wellbeing_nudges = COALESCE(EXCLUDED.enable_wellbeing_nudges, user_delight_preferences.enable_wellbeing_nudges),
          enable_easter_eggs = COALESCE(EXCLUDED.enable_easter_eggs, user_delight_preferences.enable_easter_eggs),
          enable_sounds = COALESCE(EXCLUDED.enable_sounds, user_delight_preferences.enable_sounds),
          sound_theme = COALESCE(EXCLUDED.sound_theme, user_delight_preferences.sound_theme),
          sound_volume = COALESCE(EXCLUDED.sound_volume, user_delight_preferences.sound_volume),
          updated_at = NOW()
      `, [
        stringParam('user_id', userId),
        stringParam('tenant_id', tenantId),
        stringParam('personality_mode', updates.personalityMode || 'expressive'),
        longParam('intensity_level', updates.intensityLevel || 5),
        stringParam('enable_domain_messages', String(updates.enableDomainMessages ?? true)),
        stringParam('enable_model_personality', String(updates.enableModelPersonality ?? true)),
        stringParam('enable_time_awareness', String(updates.enableTimeAwareness ?? true)),
        stringParam('enable_achievements', String(updates.enableAchievements ?? true)),
        stringParam('enable_wellbeing_nudges', String(updates.enableWellbeingNudges ?? true)),
        stringParam('enable_easter_eggs', String(updates.enableEasterEggs ?? true)),
        stringParam('enable_sounds', String(updates.enableSounds ?? false)),
        stringParam('sound_theme', updates.soundTheme || 'default'),
        longParam('sound_volume', updates.soundVolume || 50),
      ]);

      return this.getUserPreferences(userId, tenantId);
    } catch (error) {
      logger.error('Failed to update user delight preferences', { error });
      throw error;
    }
  }

  // ============================================================================
  // Achievements
  // ============================================================================

  async getUserAchievements(userId: string, tenantId: string): Promise<UserAchievement[]> {
    try {
      const result = await executeStatement<Record<string, unknown>>(`
        SELECT ua.id, ua.user_id as "userId", ua.tenant_id as "tenantId",
               ua.achievement_id as "achievementId", ua.progress_value as "progressValue",
               ua.is_unlocked as "isUnlocked", ua.unlocked_at as "unlockedAt",
               da.name, da.description, da.icon, da.rarity, da.points,
               da.celebration_message as "celebrationMessage", da.is_hidden as "isHidden"
        FROM user_achievements ua
        JOIN delight_achievements da ON ua.achievement_id = da.id
        WHERE ua.user_id = :user_id AND ua.tenant_id = :tenant_id
        ORDER BY ua.unlocked_at DESC NULLS LAST
      `, [stringParam('user_id', userId), stringParam('tenant_id', tenantId)]);

      return result.rows.map((row) => ({
        id: row.id as number,
        userId: row.userId as string,
        tenantId: row.tenantId as string,
        achievementId: row.achievementId as string,
        progressValue: row.progressValue as number,
        isUnlocked: row.isUnlocked as boolean,
        unlockedAt: row.unlockedAt as Date | null,
        createdAt: new Date(row.created_at as string || Date.now()),
        updatedAt: new Date(row.updated_at as string || Date.now()),
        achievement: {
          id: row.achievementId as string,
          name: row.name as string,
          description: row.description as string | null,
          icon: row.icon as string | null,
          badgeImageUrl: row.badge_image_url as string | null,
          achievementType: 'discovery' as AchievementType,
          thresholdValue: 1,
          thresholdConditions: {},
          celebrationMessage: row.celebrationMessage as string | null,
          celebrationSound: row.celebration_sound as string | null,
          celebrationAnimation: row.celebration_animation as string | null,
          rarity: row.rarity as AchievementRarity,
          points: row.points as number,
          isHidden: row.isHidden as boolean,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }));
    } catch (error) {
      logger.error('Failed to get user achievements', { error });
      return [];
    }
  }

  async recordAchievementProgress(
    userId: string,
    tenantId: string,
    achievementType: AchievementType,
    incrementValue: number = 1
  ): Promise<{ justUnlocked: DelightAchievement[] }> {
    const justUnlocked: DelightAchievement[] = [];
    
    try {
      const achievements = await executeStatement<DelightAchievement>(`
        SELECT id, name, description, icon, achievement_type as "achievementType",
               threshold_value as "thresholdValue", celebration_message as "celebrationMessage",
               rarity, points, is_hidden as "isHidden", is_enabled as "isEnabled"
        FROM delight_achievements
        WHERE achievement_type = :achievement_type AND is_enabled = TRUE
        ORDER BY threshold_value ASC
      `, [stringParam('achievement_type', achievementType)]);

      for (const achievement of achievements.rows) {
        const progressResult = await executeStatement<Record<string, unknown>>(`
          INSERT INTO user_achievements (user_id, tenant_id, achievement_id, progress_value)
          VALUES (:user_id, :tenant_id, :achievement_id, :increment_value)
          ON CONFLICT (user_id, tenant_id, achievement_id) DO UPDATE SET
            progress_value = user_achievements.progress_value + :increment_value,
            updated_at = NOW()
          RETURNING progress_value as "progressValue", is_unlocked as "isUnlocked"
        `, [
          stringParam('user_id', userId),
          stringParam('tenant_id', tenantId),
          stringParam('achievement_id', achievement.id),
          longParam('increment_value', incrementValue),
        ]);

        const progress = progressResult.rows[0];
        const wasUnlocked = progress.isUnlocked as boolean;
        const newProgress = progress.progressValue as number;

        if (!wasUnlocked && newProgress >= achievement.thresholdValue) {
          await executeStatement(`
            UPDATE user_achievements
            SET is_unlocked = TRUE, unlocked_at = NOW()
            WHERE user_id = :user_id AND tenant_id = :tenant_id AND achievement_id = :achievement_id
          `, [
            stringParam('user_id', userId),
            stringParam('tenant_id', tenantId),
            stringParam('achievement_id', achievement.id),
          ]);

          justUnlocked.push(achievement);
          await this.logDelightEvent(userId, tenantId, 'achievement_unlocked', undefined, achievement.id);
        }
      }

      return { justUnlocked };
    } catch (error) {
      logger.error('Failed to record achievement progress', { error });
      return { justUnlocked: [] };
    }
  }

  // ============================================================================
  // Easter Eggs
  // ============================================================================

  async triggerEasterEgg(
    userId: string,
    tenantId: string,
    triggerType: EasterEggTriggerType,
    triggerValue: string
  ): Promise<{ easterEgg: DelightEasterEgg | null; isNewDiscovery: boolean }> {
    try {
      const prefs = await this.getUserPreferences(userId, tenantId);
      if (!prefs.enableEasterEggs) {
        return { easterEgg: null, isNewDiscovery: false };
      }

      const result = await executeStatement<DelightEasterEgg>(`
        SELECT id, name, description, trigger_type as "triggerType", trigger_value as "triggerValue",
               effect_type as "effectType", effect_config as "effectConfig",
               activation_message as "activationMessage", effect_duration_seconds as "effectDurationSeconds",
               is_enabled as "isEnabled", discovery_count as "discoveryCount"
        FROM delight_easter_eggs
        WHERE trigger_type = :trigger_type AND trigger_value = :trigger_value AND is_enabled = TRUE
      `, [stringParam('trigger_type', triggerType), stringParam('trigger_value', triggerValue)]);

      if (result.rows.length === 0) {
        return { easterEgg: null, isNewDiscovery: false };
      }

      const easterEgg = result.rows[0];

      const discoveryCheck = await executeStatement<Record<string, unknown>>(`
        SELECT 1 FROM delight_event_log
        WHERE user_id = :user_id AND tenant_id = :tenant_id
          AND event_type = 'easter_egg_found' AND easter_egg_id = :easter_egg_id
        LIMIT 1
      `, [
        stringParam('user_id', userId),
        stringParam('tenant_id', tenantId),
        stringParam('easter_egg_id', easterEgg.id),
      ]);

      const isNewDiscovery = discoveryCheck.rows.length === 0;

      if (isNewDiscovery) {
        await executeStatement(`
          UPDATE delight_easter_eggs SET discovery_count = discovery_count + 1 WHERE id = :id
        `, [stringParam('id', easterEgg.id)]);

        await this.logDelightEvent(userId, tenantId, 'easter_egg_found', undefined, undefined, easterEgg.id);
        await this.recordAchievementProgress(userId, tenantId, 'discovery', 1);
      }

      return { easterEgg, isNewDiscovery };
    } catch (error) {
      logger.error('Failed to trigger easter egg', { error });
      return { easterEgg: null, isNewDiscovery: false };
    }
  }

  // ============================================================================
  // Admin CRUD
  // ============================================================================

  async getAllCategories(): Promise<DelightCategory[]> {
    const result = await executeStatement<DelightCategory>(`
      SELECT id, name, description, icon, sort_order as "sortOrder", is_enabled as "isEnabled"
      FROM delight_categories ORDER BY sort_order
    `);
    return result.rows;
  }

  async getAllMessages(filters?: { categoryId?: string; injectionPoint?: InjectionPoint }): Promise<DelightMessage[]> {
    let sql = `
      SELECT id, category_id as "categoryId", injection_point as "injectionPoint",
             trigger_type as "triggerType", message_text as "messageText",
             message_alt_texts as "messageAltTexts", domain_families as "domainFamilies",
             time_contexts as "timeContexts", display_style as "displayStyle",
             sound_effect as "soundEffect", priority, is_enabled as "isEnabled",
             requires_opt_in as "requiresOptIn"
      FROM delight_messages WHERE 1=1
    `;
    const params = [];
    
    if (filters?.categoryId) {
      sql += ' AND category_id = :category_id';
      params.push(stringParam('category_id', filters.categoryId));
    }
    if (filters?.injectionPoint) {
      sql += ' AND injection_point = :injection_point';
      params.push(stringParam('injection_point', filters.injectionPoint));
    }
    
    sql += ' ORDER BY category_id, priority DESC';
    
    const result = await executeStatement<DelightMessage>(sql, params);
    return result.rows;
  }

  async getAllAchievements(): Promise<DelightAchievement[]> {
    const result = await executeStatement<DelightAchievement>(`
      SELECT id, name, description, icon, achievement_type as "achievementType",
             threshold_value as "thresholdValue", celebration_message as "celebrationMessage",
             rarity, points, is_hidden as "isHidden", is_enabled as "isEnabled"
      FROM delight_achievements ORDER BY rarity, points DESC
    `);
    return result.rows;
  }

  async getAllEasterEggs(): Promise<DelightEasterEgg[]> {
    const result = await executeStatement<DelightEasterEgg>(`
      SELECT id, name, description, trigger_type as "triggerType", trigger_value as "triggerValue",
             effect_type as "effectType", effect_config as "effectConfig",
             activation_message as "activationMessage", effect_duration_seconds as "effectDurationSeconds",
             is_enabled as "isEnabled", discovery_count as "discoveryCount"
      FROM delight_easter_eggs ORDER BY name
    `);
    return result.rows;
  }

  async getAllSounds(): Promise<DelightSound[]> {
    const result = await executeStatement<DelightSound>(`
      SELECT id, name, sound_url as "soundUrl", sound_category as "soundCategory",
             sound_theme as "soundTheme", volume_default as "volumeDefault", is_enabled as "isEnabled"
      FROM delight_sounds ORDER BY sound_theme, sound_category
    `);
    return result.rows;
  }

  async createMessage(message: Partial<DelightMessage> & { categoryId: string; injectionPoint: InjectionPoint; triggerType: TriggerType; messageText: string }): Promise<DelightMessage> {
    const result = await executeStatement<DelightMessage>(`
      INSERT INTO delight_messages (
        category_id, injection_point, trigger_type, message_text, message_alt_texts,
        domain_families, time_contexts, display_style, sound_effect, priority,
        is_enabled, requires_opt_in
      ) VALUES (
        :category_id, :injection_point, :trigger_type, :message_text, :message_alt_texts,
        :domain_families, :time_contexts, :display_style, :sound_effect, :priority,
        :is_enabled, :requires_opt_in
      ) RETURNING id, category_id as "categoryId", injection_point as "injectionPoint",
        trigger_type as "triggerType", message_text as "messageText"
    `, [
      stringParam('category_id', message.categoryId),
      stringParam('injection_point', message.injectionPoint),
      stringParam('trigger_type', message.triggerType),
      stringParam('message_text', message.messageText),
      stringParam('message_alt_texts', JSON.stringify(message.messageAltTexts || [])),
      stringParam('domain_families', JSON.stringify(message.domainFamilies || [])),
      stringParam('time_contexts', JSON.stringify(message.timeContexts || [])),
      stringParam('display_style', message.displayStyle || 'subtle'),
      stringParam('sound_effect', message.soundEffect || ''),
      longParam('priority', message.priority || 50),
      stringParam('is_enabled', String(message.isEnabled ?? true)),
      stringParam('requires_opt_in', String(message.requiresOptIn ?? false)),
    ]);

    this.clearMessageCache();
    return result.rows[0];
  }

  async updateMessage(id: number, updates: Partial<DelightMessage>): Promise<void> {
    const setClauses: string[] = [];
    const params = [longParam('id', id)];

    if (updates.messageText !== undefined) {
      setClauses.push('message_text = :message_text');
      params.push(stringParam('message_text', updates.messageText));
    }
    if (updates.isEnabled !== undefined) {
      setClauses.push('is_enabled = :is_enabled');
      params.push(stringParam('is_enabled', String(updates.isEnabled)));
    }
    if (updates.priority !== undefined) {
      setClauses.push('priority = :priority');
      params.push(longParam('priority', updates.priority));
    }
    if (updates.displayStyle !== undefined) {
      setClauses.push('display_style = :display_style');
      params.push(stringParam('display_style', updates.displayStyle));
    }

    if (setClauses.length === 0) return;

    await executeStatement(`
      UPDATE delight_messages SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = :id
    `, params);

    this.clearMessageCache();
  }

  async deleteMessage(id: number): Promise<void> {
    await executeStatement('DELETE FROM delight_messages WHERE id = :id', [longParam('id', id)]);
    this.clearMessageCache();
  }

  async toggleCategory(id: string, isEnabled: boolean): Promise<void> {
    await executeStatement(`
      UPDATE delight_categories SET is_enabled = :is_enabled, updated_at = NOW() WHERE id = :id
    `, [stringParam('id', id), stringParam('is_enabled', String(isEnabled))]);
    this.clearMessageCache();
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  async getDelightAnalytics(tenantId: string): Promise<{
    totalMessagesShown: number;
    achievementsUnlocked: number;
    easterEggsDiscovered: number;
    engagementByMode: Record<PersonalityMode, number>;
  }> {
    try {
      const [messagesResult, achievementsResult, easterEggsResult, engagementResult] = await Promise.all([
        executeStatement<{ count: number }>(`
          SELECT COUNT(*) as count FROM delight_event_log
          WHERE tenant_id = :tenant_id AND event_type = 'message_shown'
        `, [stringParam('tenant_id', tenantId)]),
        
        executeStatement<{ count: number }>(`
          SELECT COUNT(*) as count FROM delight_event_log
          WHERE tenant_id = :tenant_id AND event_type = 'achievement_unlocked'
        `, [stringParam('tenant_id', tenantId)]),
        
        executeStatement<{ count: number }>(`
          SELECT COUNT(DISTINCT easter_egg_id) as count FROM delight_event_log
          WHERE tenant_id = :tenant_id AND event_type = 'easter_egg_found'
        `, [stringParam('tenant_id', tenantId)]),
        
        executeStatement<{ personality_mode: PersonalityMode; count: number }>(`
          SELECT personality_mode, COUNT(*) as count FROM user_delight_preferences
          WHERE tenant_id = :tenant_id GROUP BY personality_mode
        `, [stringParam('tenant_id', tenantId)]),
      ]);

      const engagementByMode: Record<PersonalityMode, number> = {
        auto: 0, professional: 0, subtle: 0, expressive: 0, playful: 0
      };
      engagementResult.rows.forEach(row => {
        engagementByMode[row.personality_mode] = row.count;
      });

      return {
        totalMessagesShown: messagesResult.rows[0]?.count || 0,
        achievementsUnlocked: achievementsResult.rows[0]?.count || 0,
        easterEggsDiscovered: easterEggsResult.rows[0]?.count || 0,
        engagementByMode,
      };
    } catch (error) {
      logger.error('Failed to get delight analytics', { error });
      return {
        totalMessagesShown: 0,
        achievementsUnlocked: 0,
        easterEggsDiscovered: 0,
        engagementByMode: { auto: 0, professional: 0, subtle: 0, expressive: 0, playful: 0 },
      };
    }
  }

  // ============================================================================
  // Auto Mode Resolution
  // ============================================================================

  /**
   * Resolves 'auto' personality mode to an actual mode based on context.
   * Auto mode intelligently selects personality based on:
   * - Time of day (more playful in evening, professional in morning)
   * - Domain type (professional for business/legal, expressive for creative)
   * - User activity patterns (adapts to usage over time)
   * - Session duration (more supportive during long sessions)
   */
  resolvePersonalityMode(
    mode: PersonalityMode,
    context?: {
      timeOfDay?: TimeContext;
      domainFamily?: string;
      sessionDurationMinutes?: number;
      isWeekend?: boolean;
    }
  ): Exclude<PersonalityMode, 'auto'> {
    if (mode !== 'auto') {
      return mode;
    }

    // Default to expressive as baseline
    let resolved: Exclude<PersonalityMode, 'auto'> = 'expressive';

    // Time-based adjustments
    if (context?.timeOfDay) {
      switch (context.timeOfDay) {
        case 'morning':
          resolved = 'subtle'; // Calm start to the day
          break;
        case 'afternoon':
          resolved = 'expressive'; // Engaged midday
          break;
        case 'evening':
        case 'night':
          resolved = 'playful'; // More relaxed evening
          break;
        case 'very_late':
          resolved = 'subtle'; // Quiet late night
          break;
        case 'weekend':
          resolved = 'playful'; // Weekend fun
          break;
      }
    }

    // Domain-based overrides
    if (context?.domainFamily) {
      const professionalDomains = ['business', 'finance', 'legal', 'medical', 'healthcare'];
      const creativeDomains = ['arts', 'creative', 'design', 'entertainment', 'media'];
      
      if (professionalDomains.some(d => context.domainFamily!.toLowerCase().includes(d))) {
        resolved = 'professional';
      } else if (creativeDomains.some(d => context.domainFamily!.toLowerCase().includes(d))) {
        resolved = 'expressive';
      }
    }

    // Long session support
    if (context?.sessionDurationMinutes && context.sessionDurationMinutes > 60) {
      // Be more supportive during long sessions
      resolved = resolved === 'professional' ? 'subtle' : 'expressive';
    }

    return resolved;
  }

  /**
   * Gets the effective personality mode with auto-resolution.
   */
  async getEffectivePersonalityMode(
    userId: string,
    tenantId: string,
    context?: {
      timeOfDay?: TimeContext;
      domainFamily?: string;
      sessionDurationMinutes?: number;
      isWeekend?: boolean;
    }
  ): Promise<Exclude<PersonalityMode, 'auto'>> {
    const prefs = await this.getUserPreferences(userId, tenantId);
    return this.resolvePersonalityMode(prefs.personalityMode, context);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private isMessageTypeEnabled(triggerType: TriggerType, prefs: UserDelightPreferences): boolean {
    switch (triggerType) {
      case 'domain_loading':
      case 'domain_transition':
        return prefs.enableDomainMessages;
      case 'time_aware':
        return prefs.enableTimeAwareness;
      case 'model_dynamics':
      case 'synthesis_quality':
        return prefs.enableModelPersonality;
      case 'achievement':
        return prefs.enableAchievements;
      case 'wellbeing':
        return prefs.enableWellbeingNudges;
      case 'easter_egg':
        return prefs.enableEasterEggs;
      default:
        return true;
    }
  }

  private filterMessages(
    messages: DelightMessage[],
    prefs: UserDelightPreferences,
    options?: { domainFamily?: string; timeContext?: TimeContext }
  ): DelightMessage[] {
    return messages.filter(msg => {
      if (options?.domainFamily && msg.domainFamilies.length > 0) {
        if (!msg.domainFamilies.includes(options.domainFamily)) return false;
      }
      if (options?.timeContext && msg.timeContexts.length > 0) {
        if (!msg.timeContexts.includes(options.timeContext)) return false;
      }
      if (prefs.intensityLevel <= 3 && msg.displayStyle === 'expressive') return false;
      if (msg.requiresOptIn && !['expressive', 'playful'].includes(prefs.personalityMode)) return false;
      return true;
    });
  }

  private selectMessage(messages: DelightMessage[]): DelightMessage {
    const totalPriority = messages.reduce((sum, m) => sum + m.priority, 0);
    let random = Math.random() * totalPriority;
    
    for (const message of messages) {
      random -= message.priority;
      if (random <= 0) return message;
    }
    
    return messages[0];
  }

  private selectMessageText(message: DelightMessage): string {
    if (message.messageAltTexts.length === 0) {
      return message.messageText;
    }
    if (Math.random() < 0.3) {
      const altIndex = Math.floor(Math.random() * message.messageAltTexts.length);
      return message.messageAltTexts[altIndex];
    }
    return message.messageText;
  }

  private async getSound(soundId: string, theme: SoundTheme): Promise<DelightSound | null> {
    try {
      const result = await executeStatement<DelightSound>(`
        SELECT id, name, sound_url as "soundUrl", sound_category as "soundCategory",
               sound_theme as "soundTheme", volume_default as "volumeDefault", is_enabled as "isEnabled"
        FROM delight_sounds
        WHERE id = :id AND (sound_theme = :theme OR sound_theme = 'default')
        ORDER BY CASE WHEN sound_theme = :theme THEN 0 ELSE 1 END
        LIMIT 1
      `, [stringParam('id', soundId), stringParam('theme', theme)]);
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch {
      return null;
    }
  }

  private async logDelightEvent(
    userId: string,
    tenantId: string,
    eventType: string,
    messageId?: number,
    achievementId?: string,
    easterEggId?: string
  ): Promise<void> {
    try {
      await executeStatement(`
        INSERT INTO delight_event_log (user_id, tenant_id, event_type, message_id, achievement_id, easter_egg_id)
        VALUES (:user_id, :tenant_id, :event_type, :message_id, :achievement_id, :easter_egg_id)
      `, [
        stringParam('user_id', userId),
        stringParam('tenant_id', tenantId),
        stringParam('event_type', eventType),
        messageId ? longParam('message_id', messageId) : stringParam('message_id', ''),
        stringParam('achievement_id', achievementId || ''),
        stringParam('easter_egg_id', easterEggId || ''),
      ]);
    } catch (error) {
      logger.debug('Failed to log delight event', { error });
    }
  }

  private getCachedMessages(cacheKey: string): DelightMessage[] | null {
    const cached = this.messageCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.messages;
    }
    return null;
  }

  private cacheMessages(cacheKey: string, messages: DelightMessage[]): void {
    this.messageCache.set(cacheKey, { messages, cachedAt: Date.now() });
  }

  private clearMessageCache(): void {
    this.messageCache.clear();
  }

  private getDefaultPreferences(userId: string, tenantId: string): UserDelightPreferences {
    return {
      id: 0,
      userId,
      tenantId,
      enabled: true,
      personalityMode: 'auto',
      intensityLevel: 5,
      enableDomainMessages: true,
      enableModelPersonality: true,
      enableTimeAwareness: true,
      enableAchievements: true,
      enableWellbeingNudges: true,
      enableEasterEggs: true,
      enableSounds: false,
      soundTheme: 'default',
      soundVolume: 50,
      messagePosition: 'inline' as const,
      showModelAttributions: true,
      showConfidenceIndicators: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private mapRowToPreferences(row: Record<string, unknown>): UserDelightPreferences {
    return {
      id: row.id as number,
      userId: row.user_id as string,
      tenantId: row.tenant_id as string,
      enabled: row.enabled !== false,
      personalityMode: (row.personality_mode as PersonalityMode) || 'expressive',
      intensityLevel: (row.intensity_level as number) || 5,
      enableDomainMessages: row.enable_domain_messages !== false,
      enableModelPersonality: row.enable_model_personality !== false,
      enableTimeAwareness: row.enable_time_awareness !== false,
      enableAchievements: row.enable_achievements !== false,
      enableWellbeingNudges: row.enable_wellbeing_nudges !== false,
      enableEasterEggs: row.enable_easter_eggs !== false,
      enableSounds: row.enable_sounds === true,
      soundTheme: (row.sound_theme as SoundTheme) || 'default',
      soundVolume: (row.sound_volume as number) || 50,
      messagePosition: (row.message_position as 'status_bar' | 'toast' | 'inline' | 'margin') || 'inline',
      showModelAttributions: row.show_model_attributions !== false,
      showConfidenceIndicators: row.show_confidence_indicators !== false,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  // ============================================================================
  // Detailed Statistics (from persistent tables)
  // ============================================================================

  async getDetailedStatistics(tenantId: string): Promise<DetailedDelightStatistics> {
    try {
      const [overview, dailyStats, topMessages, achievementStats, easterEggStats, weeklyTrends] = await Promise.all([
        this.getOverviewStats(tenantId),
        this.getDailyStats(tenantId, 30),
        this.getTopMessages(tenantId, 20),
        this.getAchievementStats(tenantId),
        this.getEasterEggStats(tenantId),
        this.getWeeklyTrends(tenantId, 12),
      ]);

      return {
        overview,
        dailyStats,
        topMessages,
        achievementStats,
        easterEggStats,
        weeklyTrends,
      };
    } catch (error) {
      logger.error('Failed to get detailed statistics', { error, tenantId });
      throw error;
    }
  }

  async getOverviewStats(tenantId: string): Promise<OverviewStats> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT 
        COALESCE(SUM(messages_shown), 0) as total_messages,
        COALESCE(SUM(achievements_unlocked), 0) as total_achievements,
        COALESCE(SUM(easter_eggs_discovered), 0) as total_easter_eggs,
        COALESCE(SUM(sounds_played), 0) as total_sounds,
        COALESCE(SUM(active_users), 0) as total_users,
        MIN(stat_date) as first_date,
        MAX(stat_date) as last_date,
        COUNT(DISTINCT stat_date) as days_active
      FROM delight_daily_stats
      WHERE tenant_id = :tenant_id
    `, [stringParam('tenant_id', tenantId)]);

    const row = result.rows[0] || {};
    return {
      totalMessagesShown: parseInt(String(row.total_messages || 0)),
      totalAchievementsUnlocked: parseInt(String(row.total_achievements || 0)),
      totalEasterEggsDiscovered: parseInt(String(row.total_easter_eggs || 0)),
      totalSoundsPlayed: parseInt(String(row.total_sounds || 0)),
      totalActiveUsers: parseInt(String(row.total_users || 0)),
      firstActivityDate: row.first_date as string | null,
      lastActivityDate: row.last_date as string | null,
      daysWithActivity: parseInt(String(row.days_active || 0)),
    };
  }

  async getDailyStats(tenantId: string, days: number = 30): Promise<DailyStats[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT 
        stat_date,
        messages_shown,
        achievements_unlocked,
        easter_eggs_discovered,
        sounds_played,
        active_users,
        messages_by_category,
        messages_by_injection_point,
        users_by_personality_mode
      FROM delight_daily_stats
      WHERE tenant_id = :tenant_id
        AND stat_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY stat_date DESC
    `, [stringParam('tenant_id', tenantId)]);

    return result.rows.map(row => ({
      date: String(row.stat_date),
      messagesShown: parseInt(String(row.messages_shown || 0)),
      achievementsUnlocked: parseInt(String(row.achievements_unlocked || 0)),
      easterEggsDiscovered: parseInt(String(row.easter_eggs_discovered || 0)),
      soundsPlayed: parseInt(String(row.sounds_played || 0)),
      activeUsers: parseInt(String(row.active_users || 0)),
      messagesByCategory: (row.messages_by_category || {}) as Record<string, number>,
      messagesByInjectionPoint: (row.messages_by_injection_point || {}) as Record<string, number>,
      usersByPersonalityMode: (row.users_by_personality_mode || {}) as Record<string, number>,
    }));
  }

  async getTopMessages(tenantId: string, limit: number = 20): Promise<MessageStats[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT 
        dms.message_id,
        dm.message_text,
        dm.category_id,
        dm.injection_point,
        dm.trigger_type,
        dm.display_style,
        dms.total_shown,
        dms.total_unique_users,
        dms.shown_today,
        dms.shown_this_week,
        dms.shown_this_month,
        dms.first_shown_at,
        dms.last_shown_at
      FROM delight_message_stats dms
      JOIN delight_messages dm ON dms.message_id = dm.id
      WHERE dms.tenant_id = :tenant_id
      ORDER BY dms.total_shown DESC
      LIMIT :limit
    `, [stringParam('tenant_id', tenantId), longParam('limit', limit)]);

    return result.rows.map(row => ({
      messageId: parseInt(String(row.message_id)),
      messageText: String(row.message_text),
      categoryId: String(row.category_id),
      injectionPoint: String(row.injection_point),
      triggerType: String(row.trigger_type),
      displayStyle: String(row.display_style),
      totalShown: parseInt(String(row.total_shown || 0)),
      totalUniqueUsers: parseInt(String(row.total_unique_users || 0)),
      shownToday: parseInt(String(row.shown_today || 0)),
      shownThisWeek: parseInt(String(row.shown_this_week || 0)),
      shownThisMonth: parseInt(String(row.shown_this_month || 0)),
      firstShownAt: row.first_shown_at as string | null,
      lastShownAt: row.last_shown_at as string | null,
    }));
  }

  async getAchievementStats(tenantId: string): Promise<AchievementStats[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT 
        das.achievement_id,
        da.name,
        da.description,
        da.achievement_type,
        da.rarity,
        da.points,
        das.total_unlocked,
        das.total_in_progress,
        das.unlocked_today,
        das.unlocked_this_week,
        das.unlocked_this_month,
        das.average_days_to_unlock,
        das.first_unlocked_at,
        das.last_unlocked_at
      FROM delight_achievement_stats das
      JOIN delight_achievements da ON das.achievement_id = da.id
      WHERE das.tenant_id = :tenant_id
      ORDER BY das.total_unlocked DESC
    `, [stringParam('tenant_id', tenantId)]);

    return result.rows.map(row => ({
      achievementId: String(row.achievement_id),
      name: String(row.name),
      description: row.description as string | null,
      achievementType: String(row.achievement_type),
      rarity: String(row.rarity),
      points: parseInt(String(row.points || 0)),
      totalUnlocked: parseInt(String(row.total_unlocked || 0)),
      totalInProgress: parseInt(String(row.total_in_progress || 0)),
      unlockedToday: parseInt(String(row.unlocked_today || 0)),
      unlockedThisWeek: parseInt(String(row.unlocked_this_week || 0)),
      unlockedThisMonth: parseInt(String(row.unlocked_this_month || 0)),
      averageDaysToUnlock: parseFloat(String(row.average_days_to_unlock || 0)),
      firstUnlockedAt: row.first_unlocked_at as string | null,
      lastUnlockedAt: row.last_unlocked_at as string | null,
    }));
  }

  async getEasterEggStats(tenantId: string): Promise<EasterEggStats[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT 
        des.easter_egg_id,
        dee.name,
        dee.description,
        dee.trigger_type,
        dee.effect_type,
        des.total_discoveries,
        des.total_activations,
        des.discovered_today,
        des.discovered_this_week,
        des.discovered_this_month,
        des.first_discovered_at,
        des.last_discovered_at
      FROM delight_easter_egg_stats des
      JOIN delight_easter_eggs dee ON des.easter_egg_id = dee.id
      WHERE des.tenant_id = :tenant_id
      ORDER BY des.total_discoveries DESC
    `, [stringParam('tenant_id', tenantId)]);

    return result.rows.map(row => ({
      easterEggId: String(row.easter_egg_id),
      name: String(row.name),
      description: row.description as string | null,
      triggerType: String(row.trigger_type),
      effectType: String(row.effect_type),
      totalDiscoveries: parseInt(String(row.total_discoveries || 0)),
      totalActivations: parseInt(String(row.total_activations || 0)),
      discoveredToday: parseInt(String(row.discovered_today || 0)),
      discoveredThisWeek: parseInt(String(row.discovered_this_week || 0)),
      discoveredThisMonth: parseInt(String(row.discovered_this_month || 0)),
      firstDiscoveredAt: row.first_discovered_at as string | null,
      lastDiscoveredAt: row.last_discovered_at as string | null,
    }));
  }

  async getWeeklyTrends(tenantId: string, weeks: number = 12): Promise<WeeklyTrend[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT 
        DATE_TRUNC('week', stat_date) as week_start,
        SUM(messages_shown) as messages_shown,
        SUM(achievements_unlocked) as achievements_unlocked,
        SUM(easter_eggs_discovered) as easter_eggs_discovered,
        SUM(active_users) as active_users
      FROM delight_daily_stats
      WHERE tenant_id = :tenant_id
        AND stat_date >= CURRENT_DATE - INTERVAL '${weeks} weeks'
      GROUP BY DATE_TRUNC('week', stat_date)
      ORDER BY week_start DESC
    `, [stringParam('tenant_id', tenantId)]);

    return result.rows.map(row => ({
      weekStart: String(row.week_start),
      messagesShown: parseInt(String(row.messages_shown || 0)),
      achievementsUnlocked: parseInt(String(row.achievements_unlocked || 0)),
      easterEggsDiscovered: parseInt(String(row.easter_eggs_discovered || 0)),
      activeUsers: parseInt(String(row.active_users || 0)),
    }));
  }

  async getUserEngagement(tenantId: string, limit: number = 50): Promise<UserEngagement[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT 
        user_id,
        total_messages_seen,
        unique_messages_seen,
        favorite_category,
        total_achievements_unlocked,
        total_achievement_points,
        current_streak_days,
        longest_streak_days,
        total_easter_eggs_found,
        first_interaction_at,
        last_interaction_at,
        total_sessions
      FROM delight_user_engagement
      WHERE tenant_id = :tenant_id
      ORDER BY total_achievement_points DESC
      LIMIT :limit
    `, [stringParam('tenant_id', tenantId), longParam('limit', limit)]);

    return result.rows.map(row => ({
      userId: String(row.user_id),
      totalMessagesSeen: parseInt(String(row.total_messages_seen || 0)),
      uniqueMessagesSeen: parseInt(String(row.unique_messages_seen || 0)),
      favoriteCategory: row.favorite_category as string | null,
      totalAchievementsUnlocked: parseInt(String(row.total_achievements_unlocked || 0)),
      totalAchievementPoints: parseInt(String(row.total_achievement_points || 0)),
      currentStreakDays: parseInt(String(row.current_streak_days || 0)),
      longestStreakDays: parseInt(String(row.longest_streak_days || 0)),
      totalEasterEggsFound: parseInt(String(row.total_easter_eggs_found || 0)),
      firstInteractionAt: row.first_interaction_at as string | null,
      lastInteractionAt: row.last_interaction_at as string | null,
      totalSessions: parseInt(String(row.total_sessions || 0)),
    }));
  }
}

// Statistics Types
export interface OverviewStats {
  totalMessagesShown: number;
  totalAchievementsUnlocked: number;
  totalEasterEggsDiscovered: number;
  totalSoundsPlayed: number;
  totalActiveUsers: number;
  firstActivityDate: string | null;
  lastActivityDate: string | null;
  daysWithActivity: number;
}

export interface DailyStats {
  date: string;
  messagesShown: number;
  achievementsUnlocked: number;
  easterEggsDiscovered: number;
  soundsPlayed: number;
  activeUsers: number;
  messagesByCategory: Record<string, number>;
  messagesByInjectionPoint: Record<string, number>;
  usersByPersonalityMode: Record<string, number>;
}

export interface MessageStats {
  messageId: number;
  messageText: string;
  categoryId: string;
  injectionPoint: string;
  triggerType: string;
  displayStyle: string;
  totalShown: number;
  totalUniqueUsers: number;
  shownToday: number;
  shownThisWeek: number;
  shownThisMonth: number;
  firstShownAt: string | null;
  lastShownAt: string | null;
}

export interface AchievementStats {
  achievementId: string;
  name: string;
  description: string | null;
  achievementType: string;
  rarity: string;
  points: number;
  totalUnlocked: number;
  totalInProgress: number;
  unlockedToday: number;
  unlockedThisWeek: number;
  unlockedThisMonth: number;
  averageDaysToUnlock: number;
  firstUnlockedAt: string | null;
  lastUnlockedAt: string | null;
}

export interface EasterEggStats {
  easterEggId: string;
  name: string;
  description: string | null;
  triggerType: string;
  effectType: string;
  totalDiscoveries: number;
  totalActivations: number;
  discoveredToday: number;
  discoveredThisWeek: number;
  discoveredThisMonth: number;
  firstDiscoveredAt: string | null;
  lastDiscoveredAt: string | null;
}

export interface WeeklyTrend {
  weekStart: string;
  messagesShown: number;
  achievementsUnlocked: number;
  easterEggsDiscovered: number;
  activeUsers: number;
}

export interface UserEngagement {
  userId: string;
  totalMessagesSeen: number;
  uniqueMessagesSeen: number;
  favoriteCategory: string | null;
  totalAchievementsUnlocked: number;
  totalAchievementPoints: number;
  currentStreakDays: number;
  longestStreakDays: number;
  totalEasterEggsFound: number;
  firstInteractionAt: string | null;
  lastInteractionAt: string | null;
  totalSessions: number;
}

export interface DetailedDelightStatistics {
  overview: OverviewStats;
  dailyStats: DailyStats[];
  topMessages: MessageStats[];
  achievementStats: AchievementStats[];
  easterEggStats: EasterEggStats[];
  weeklyTrends: WeeklyTrend[];
}

export const delightService = new DelightService();
export { DelightService };
