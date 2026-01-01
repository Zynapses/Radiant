// RADIANT v4.18.0 - Localization Types
// Defines the 18 supported languages across all RADIANT applications

/**
 * Supported language definition
 */
export interface SupportedLanguage {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  isRTL: boolean;
  displayOrder: number;
}

/**
 * Language codes supported by RADIANT (18 languages)
 */
export type LanguageCode =
  | 'en'      // English
  | 'es'      // Spanish
  | 'fr'      // French
  | 'de'      // German
  | 'pt'      // Portuguese
  | 'it'      // Italian
  | 'nl'      // Dutch
  | 'pl'      // Polish
  | 'ru'      // Russian
  | 'tr'      // Turkish
  | 'ja'      // Japanese
  | 'ko'      // Korean
  | 'zh-CN'   // Chinese (Simplified)
  | 'zh-TW'   // Chinese (Traditional)
  | 'ar'      // Arabic
  | 'hi'      // Hindi
  | 'th'      // Thai
  | 'vi';     // Vietnamese

/**
 * All 18 supported languages with metadata
 * Order matches database migration 031_internationalization.sql
 */
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', isRTL: false, displayOrder: 1 },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRTL: false, displayOrder: 2 },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', isRTL: false, displayOrder: 3 },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', isRTL: false, displayOrder: 4 },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', isRTL: false, displayOrder: 5 },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', isRTL: false, displayOrder: 6 },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', isRTL: false, displayOrder: 7 },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', isRTL: false, displayOrder: 8 },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', isRTL: false, displayOrder: 9 },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', isRTL: false, displayOrder: 10 },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', isRTL: false, displayOrder: 11 },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', isRTL: false, displayOrder: 12 },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳', isRTL: false, displayOrder: 13 },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', flag: '🇹🇼', isRTL: false, displayOrder: 14 },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', isRTL: true, displayOrder: 15 },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', isRTL: false, displayOrder: 16 },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', isRTL: false, displayOrder: 17 },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', isRTL: false, displayOrder: 18 },
];

/**
 * Get language by code
 */
export function getLanguageByCode(code: string): SupportedLanguage | undefined {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
}

/**
 * Check if a language code is supported
 */
export function isValidLanguageCode(code: string): code is LanguageCode {
  return SUPPORTED_LANGUAGES.some(lang => lang.code === code);
}

/**
 * Get RTL languages
 */
export function getRTLLanguages(): SupportedLanguage[] {
  return SUPPORTED_LANGUAGES.filter(lang => lang.isRTL);
}

/**
 * Translation status enum
 */
export type TranslationStatus = 'pending' | 'ai_translated' | 'needs_review' | 'approved' | 'rejected';

/**
 * Translation entry
 */
export interface Translation {
  id: string;
  registryId: string;
  languageCode: LanguageCode;
  translatedText: string;
  status: TranslationStatus;
  translatorType: 'human' | 'ai' | 'imported';
  translatorId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  qualityScore?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Localization registry entry (source string)
 */
export interface LocalizationEntry {
  id: string;
  key: string;
  defaultText: string;
  context?: string;
  category: string;
  maxLength?: number;
  placeholders?: string[];
  isPlural: boolean;
  pluralForms?: Record<string, string>;
  appId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Translation bundle (cached translations for a language)
 */
export interface TranslationBundle {
  languageCode: LanguageCode;
  appId?: string;
  category?: string;
  translations: Record<string, string>;
  bundleHash: string;
  entryCount: number;
  generatedAt: string;
  expiresAt?: string;
}

/**
 * User language preference
 */
export interface UserLanguagePreference {
  userId: string;
  languageCode: LanguageCode;
  timezone?: string;
  dateFormat?: string;
  numberFormat?: string;
  updatedAt: string;
}
