/**
 * RADIANT v4.18.0 - Translation Hook
 * 
 * Provides localization support for all UI components.
 * Fetches translations from the localization registry.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// Supported languages
interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', flag: '🇹🇼' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', rtl: true },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
];

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

interface TranslationCache {
  [key: string]: string;
}

// Local storage key for language preference
const LANGUAGE_KEY = 'radiant_language';

// Get browser language or stored preference
function getInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';
  
  // Check stored preference
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.some(l => l.code === stored)) {
    return stored as LanguageCode;
  }
  
  // Check browser language
  const browserLang = navigator.language.split('-')[0];
  const match = SUPPORTED_LANGUAGES.find(l => l.code.startsWith(browserLang));
  return match?.code || 'en';
}

// Global state for current language
let currentLanguage: LanguageCode = 'en';
const languageListeners: Set<(lang: LanguageCode) => void> = new Set();

export function setLanguage(lang: LanguageCode): void {
  currentLanguage = lang;
  if (typeof window !== 'undefined') {
    localStorage.setItem(LANGUAGE_KEY, lang);
    
    // Update document direction for RTL languages
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === lang);
    document.documentElement.dir = langInfo?.rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }
  languageListeners.forEach(listener => listener(lang));
}

export function getLanguage(): LanguageCode {
  return currentLanguage;
}

/**
 * Hook to use translations in components
 */
export function useTranslation(namespace?: string) {
  const [language, setLang] = useState<LanguageCode>(currentLanguage);
  
  // Initialize language on mount
  useEffect(() => {
    const initial = getInitialLanguage();
    if (initial !== currentLanguage) {
      setLanguage(initial);
    }
    setLang(currentLanguage);
    
    // Subscribe to language changes
    const listener = (lang: LanguageCode) => setLang(lang);
    languageListeners.add(listener);
    return () => { languageListeners.delete(listener); };
  }, []);
  
  // Fetch translations for current language
  const { data: translations = {} } = useQuery<TranslationCache>({
    queryKey: ['translations', language, namespace],
    queryFn: async () => {
      const params = new URLSearchParams({ language });
      if (namespace) params.append('category', namespace);
      
      const response = await fetch(`/api/localization/translations?${params}`);
      if (!response.ok) return {};
      
      const data = await response.json();
      return data.translations || {};
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Translation function
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    let text = translations[fullKey] || translations[key] || key;
    
    // Replace placeholders
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    
    return text;
  }, [translations, namespace]);
  
  // Check if language is RTL
  const isRTL = SUPPORTED_LANGUAGES.find(l => l.code === language)?.rtl || false;
  
  return {
    t,
    language,
    setLanguage,
    isRTL,
    languages: SUPPORTED_LANGUAGES,
  };
}

/**
 * Language selector component hook
 */
export function useLanguageSelector() {
  const { language, setLanguage, languages } = useTranslation();
  
  const currentLang = languages.find(l => l.code === language) || languages[0];
  
  return {
    currentLanguage: currentLang,
    languages,
    setLanguage,
  };
}
