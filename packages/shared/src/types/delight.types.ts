/**
 * RADIANT v4.18.0 - Think Tank Delight System Types
 * Personality, humor, and delightful feedback for AI orchestration
 */

// ============================================================================
// Enums and Constants
// ============================================================================

export type InjectionPoint = 'pre_execution' | 'during_execution' | 'post_execution';

export type TriggerType = 
  | 'domain_loading'
  | 'domain_transition'
  | 'time_aware'
  | 'model_dynamics'
  | 'complexity_signals'
  | 'synthesis_quality'
  | 'achievement'
  | 'wellbeing'
  | 'easter_egg';

export type DisplayStyle = 'subtle' | 'moderate' | 'expressive';

export type AnimationType = 'fade' | 'slide' | 'bounce' | 'none';

export type PersonalityMode = 'auto' | 'professional' | 'subtle' | 'expressive' | 'playful';

export type AchievementType = 
  | 'domain_explorer'
  | 'streak'
  | 'complexity'
  | 'discovery'
  | 'time_spent'
  | 'queries_count';

export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type EasterEggTriggerType = 
  | 'key_sequence'
  | 'text_input'
  | 'time_based'
  | 'random'
  | 'usage_pattern';

export type EasterEggEffectType = 
  | 'mode_change'
  | 'visual_transform'
  | 'sound_play'
  | 'message_show'
  | 'interface_mod';

export type SoundCategory = 
  | 'confirmation'
  | 'transition'
  | 'achievement'
  | 'ambient'
  | 'notification';

export type SoundTheme = 
  | 'default'
  | 'mission_control'
  | 'library'
  | 'workshop'
  | 'minimal'
  | 'emissions';

export type TimeContext = 
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'weekend'
  | 'holiday'
  | 'long_session'
  | 'very_late'
  | 'returning';

export type MessagePosition = 'status_bar' | 'toast' | 'inline' | 'margin';

// ============================================================================
// Core Entities
// ============================================================================

export interface DelightCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DelightMessage {
  id: number;
  categoryId: string;
  injectionPoint: InjectionPoint;
  triggerType: TriggerType;
  triggerConditions: Record<string, unknown>;
  messageText: string;
  messageAltTexts: string[];
  domainFamilies: string[];
  specificDomains: string[];
  targetModels: string[];
  timeContexts: TimeContext[];
  displayDurationMs: number;
  displayStyle: DisplayStyle;
  animationType: AnimationType;
  soundEffect: string | null;
  priority: number;
  cooldownMinutes: number;
  maxDisplaysPerSession: number;
  isEnabled: boolean;
  requiresOptIn: boolean;
  isEasterEgg: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DelightAchievement {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  badgeImageUrl: string | null;
  achievementType: AchievementType;
  thresholdValue: number;
  thresholdConditions: Record<string, unknown>;
  celebrationMessage: string | null;
  celebrationSound: string | null;
  celebrationAnimation: string | null;
  rarity: AchievementRarity;
  points: number;
  isHidden: boolean;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAchievement {
  id: number;
  userId: string;
  tenantId: string;
  achievementId: string;
  progressValue: number;
  isUnlocked: boolean;
  unlockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  achievement?: DelightAchievement;
}

export interface UserDelightPreferences {
  id: number;
  userId: string;
  tenantId: string;
  personalityMode: PersonalityMode;
  intensityLevel: number;
  enableDomainMessages: boolean;
  enableModelPersonality: boolean;
  enableTimeAwareness: boolean;
  enableAchievements: boolean;
  enableWellbeingNudges: boolean;
  enableEasterEggs: boolean;
  enableSounds: boolean;
  soundTheme: SoundTheme;
  soundVolume: number;
  messagePosition: MessagePosition;
  showModelAttributions: boolean;
  showConfidenceIndicators: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DelightEasterEgg {
  id: string;
  name: string;
  description: string | null;
  triggerType: EasterEggTriggerType;
  triggerValue: string;
  effectType: EasterEggEffectType;
  effectConfig: Record<string, unknown>;
  effectDurationSeconds: number;
  activationMessage: string | null;
  deactivationMessage: string | null;
  isEnabled: boolean;
  discoveryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DelightSound {
  id: string;
  name: string;
  description: string | null;
  soundUrl: string | null;
  soundDataBase64: string | null;
  soundCategory: SoundCategory;
  soundTheme: SoundTheme;
  volumeDefault: number;
  durationMs: number | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DelightEventLog {
  id: number;
  userId: string;
  tenantId: string;
  eventType: 'message_shown' | 'achievement_unlocked' | 'easter_egg_found' | 'sound_played';
  eventData: Record<string, unknown>;
  messageId: number | null;
  achievementId: string | null;
  easterEggId: string | null;
  createdAt: Date;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GetDelightMessageRequest {
  injectionPoint: InjectionPoint;
  triggerType?: TriggerType;
  domainFamily?: string;
  specificDomain?: string;
  modelId?: string;
  timeContext?: TimeContext;
  sessionId?: string;
}

export interface DelightMessageResponse {
  message: DelightMessage | null;
  sound?: DelightSound | null;
  selectedText: string;
}

export interface GetDelightContextRequest {
  userId: string;
  tenantId: string;
  currentDomain?: string;
  previousDomain?: string;
  sessionDurationMinutes?: number;
  queryComplexity?: 'simple' | 'moderate' | 'complex';
  modelConsensus?: 'strong' | 'moderate' | 'divergent';
  isReturningUser?: boolean;
}

export interface DelightContextResponse {
  preferences: UserDelightPreferences;
  achievements: UserAchievement[];
  unlockedAchievementsCount: number;
  totalPoints: number;
  activeEasterEggs: string[];
  suggestedMessages: DelightMessage[];
}

export interface UpdateDelightPreferencesRequest {
  personalityMode?: PersonalityMode;
  intensityLevel?: number;
  enableDomainMessages?: boolean;
  enableModelPersonality?: boolean;
  enableTimeAwareness?: boolean;
  enableAchievements?: boolean;
  enableWellbeingNudges?: boolean;
  enableEasterEggs?: boolean;
  enableSounds?: boolean;
  soundTheme?: SoundTheme;
  soundVolume?: number;
  messagePosition?: MessagePosition;
  showModelAttributions?: boolean;
  showConfidenceIndicators?: boolean;
}

export interface TriggerEasterEggRequest {
  triggerType: EasterEggTriggerType;
  triggerValue: string;
}

export interface EasterEggActivationResponse {
  easterEgg: DelightEasterEgg | null;
  isNewDiscovery: boolean;
  achievementUnlocked?: DelightAchievement | null;
}

export interface RecordAchievementProgressRequest {
  achievementType: AchievementType;
  incrementValue?: number;
  absoluteValue?: number;
}

export interface AchievementProgressResponse {
  achievement: DelightAchievement;
  currentProgress: number;
  isUnlocked: boolean;
  justUnlocked: boolean;
}

// ============================================================================
// Admin API Types
// ============================================================================

export interface CreateDelightMessageRequest {
  categoryId: string;
  injectionPoint: InjectionPoint;
  triggerType: TriggerType;
  triggerConditions?: Record<string, unknown>;
  messageText: string;
  messageAltTexts?: string[];
  domainFamilies?: string[];
  specificDomains?: string[];
  targetModels?: string[];
  timeContexts?: TimeContext[];
  displayDurationMs?: number;
  displayStyle?: DisplayStyle;
  animationType?: AnimationType;
  soundEffect?: string;
  priority?: number;
  cooldownMinutes?: number;
  maxDisplaysPerSession?: number;
  isEnabled?: boolean;
  requiresOptIn?: boolean;
  isEasterEgg?: boolean;
}

export interface UpdateDelightMessageRequest extends Partial<CreateDelightMessageRequest> {
  id: number;
}

export interface CreateDelightAchievementRequest {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  badgeImageUrl?: string;
  achievementType: AchievementType;
  thresholdValue: number;
  thresholdConditions?: Record<string, unknown>;
  celebrationMessage?: string;
  celebrationSound?: string;
  celebrationAnimation?: string;
  rarity?: AchievementRarity;
  points?: number;
  isHidden?: boolean;
  isEnabled?: boolean;
}

export interface UpdateDelightAchievementRequest extends Partial<Omit<CreateDelightAchievementRequest, 'id'>> {
  id: string;
}

export interface CreateEasterEggRequest {
  id: string;
  name: string;
  description?: string;
  triggerType: EasterEggTriggerType;
  triggerValue: string;
  effectType: EasterEggEffectType;
  effectConfig?: Record<string, unknown>;
  effectDurationSeconds?: number;
  activationMessage?: string;
  deactivationMessage?: string;
  isEnabled?: boolean;
}

export interface UpdateEasterEggRequest extends Partial<Omit<CreateEasterEggRequest, 'id'>> {
  id: string;
}

export interface DelightAnalytics {
  totalMessagesShown: number;
  messagesByCategory: Record<string, number>;
  achievementsUnlocked: number;
  easterEggsDiscovered: number;
  mostPopularMessages: Array<{ messageId: number; count: number; text: string }>;
  mostUnlockedAchievements: Array<{ achievementId: string; count: number; name: string }>;
  userEngagementByMode: Record<PersonalityMode, number>;
}

// ============================================================================
// Real-time Events (for WebSocket/SSE)
// ============================================================================

export interface DelightRealtimeEvent {
  type: 'message' | 'achievement' | 'easter_egg' | 'sound';
  timestamp: Date;
  data: DelightMessage | UserAchievement | DelightEasterEgg | DelightSound;
  metadata?: Record<string, unknown>;
}

export interface OrchestrationDelightContext {
  sessionId: string;
  currentPhase: InjectionPoint;
  domainInfo: {
    currentDomain: string | null;
    previousDomain: string | null;
    isDomainSwitch: boolean;
  };
  modelInfo: {
    activeModels: string[];
    consensusLevel: 'strong' | 'moderate' | 'divergent';
    leadingModel: string | null;
  };
  timeInfo: {
    sessionDurationMinutes: number;
    timeOfDay: TimeContext;
    isWeekend: boolean;
  };
  queryInfo: {
    complexity: 'simple' | 'moderate' | 'complex';
    isMultiPart: boolean;
    isNovel: boolean;
  };
}
