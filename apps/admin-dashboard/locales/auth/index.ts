/**
 * RADIANT v5.52.29 - Auth Localization Index (PROMPT-41D)
 * 
 * Exports all authentication translations for 18 supported languages.
 */

import en from './en.json';
import zhCN from './zh-CN.json';
import ja from './ja.json';
import ko from './ko.json';
import ar from './ar.json';

// Re-export individual translations
export { en, zhCN, ja, ko, ar };

// Combined translations map
export const authTranslations: Record<string, typeof en> = {
  'en': en,
  'zh-CN': zhCN,
  'zh-TW': zhCN, // Use simplified as base for traditional
  'ja': ja,
  'ko': ko,
  'ar': ar,
  // Fallback to English for other languages until translations are added
  'es': en,
  'fr': en,
  'de': en,
  'pt': en,
  'it': en,
  'nl': en,
  'pl': en,
  'ru': en,
  'tr': en,
  'hi': en,
  'th': en,
  'vi': en,
};

/**
 * Get flattened translation keys for a language
 */
export function getAuthTranslations(locale: string): Record<string, string> {
  const translations = authTranslations[locale] || authTranslations['en'];
  return flattenObject(translations);
}

/**
 * Flatten nested object to dot-notation keys
 */
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = String(value);
    }
  }
  
  return result;
}

export default authTranslations;
