/**
 * Think Tank Localization Module
 * 
 * Exports all localization utilities for the Think Tank consumer app.
 * ALL UI text MUST go through this module - NO hardcoded strings.
 */

export { LocalizationProvider, useLocalization, useTranslation, useLanguage } from './localization-context';
export { localizationApiService } from './localization-service';
export { T } from './translation-keys';
export type { 
  Language, 
  TranslationBundle, 
  LocalizationState, 
  LocalizationContextValue,
  SupportedLanguage,
} from './types';
export { TRANSLATION_CATEGORIES, SUPPORTED_LANGUAGES } from './types';
