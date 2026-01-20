/**
 * Think Tank Localization Types
 * 
 * All UI text strings MUST be registered in the Radiant localization registry
 * and accessed through the API. NO hardcoded strings.
 */

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  isDefault: boolean;
  displayOrder: number;
}

export interface TranslationBundle {
  [key: string]: string;
}

export interface LocalizationState {
  language: string;
  languages: Language[];
  translations: TranslationBundle;
  isLoading: boolean;
  error: string | null;
}

export interface LocalizationContextValue extends LocalizationState {
  setLanguage: (code: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  refreshTranslations: () => Promise<void>;
}

/**
 * Translation key categories for Think Tank Consumer App
 * All keys MUST follow format: thinktank.{category}.{key}
 */
export const TRANSLATION_CATEGORIES = {
  COMMON: 'thinktank.common',
  CHAT: 'thinktank.chat',
  SETTINGS: 'thinktank.settings',
  RULES: 'thinktank.rules',
  HISTORY: 'thinktank.history',
  ARTIFACTS: 'thinktank.artifacts',
  PROFILE: 'thinktank.profile',
  ERRORS: 'thinktank.errors',
  NOTIFICATIONS: 'thinktank.notifications',
  ACTIONS: 'thinktank.actions',
  LABELS: 'thinktank.labels',
  PLACEHOLDERS: 'thinktank.placeholders',
  TOOLTIPS: 'thinktank.tooltips',
  MODES: 'thinktank.modes',
  MODELS: 'thinktank.models',
} as const;

/**
 * Supported languages (matches Radiant Translation Middleware)
 */
export const SUPPORTED_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ru', 'tr',
  'ja', 'ko', 'zh-CN', 'zh-TW', 'ar', 'hi', 'th', 'vi'
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
