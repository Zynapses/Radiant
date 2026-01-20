'use client';

/**
 * Localization Context Provider
 * 
 * Provides translation functions and language state to the entire app.
 * ALL translations come from the Radiant API - NO hardcoded strings.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { localizationApiService } from './localization-service';
import { DEFAULT_TRANSLATIONS } from './default-translations';
import type { Language, TranslationBundle, LocalizationContextValue } from './types';

const STORAGE_KEY = 'thinktank-language';
const DEFAULT_LANGUAGE = 'en';

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

interface LocalizationProviderProps {
  children: React.ReactNode;
  initialLanguage?: string;
}

export function LocalizationProvider({ children, initialLanguage }: LocalizationProviderProps) {
  const [language, setLanguageState] = useState<string>(initialLanguage || DEFAULT_LANGUAGE);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [translations, setTranslations] = useState<TranslationBundle>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // null = not yet determined, true/false = determined
  const [isSimulator, setIsSimulator] = useState<boolean | null>(null);

  // Determine if we're on simulator route (runs once on mount)
  useEffect(() => {
    setIsSimulator(window.location.pathname.startsWith('/simulator'));
  }, []);

  // Load saved language preference on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem(STORAGE_KEY);
    if (savedLanguage) {
      setLanguageState(savedLanguage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load languages list (skip for simulator, wait until determined)
  useEffect(() => {
    // Wait until we know if we're on simulator
    if (isSimulator === null) return;
    
    if (isSimulator) {
      setLanguages([{
        code: 'en',
        name: 'English',
        nativeName: 'English',
        direction: 'ltr',
        isDefault: true,
        displayOrder: 1,
      }]);
      setIsLoading(false);
      return;
    }

    const loadLanguages = async () => {
      try {
        const langs = await localizationApiService.getLanguages();
        setLanguages(langs);
      } catch (err) {
        console.error('Failed to load languages:', err);
        // Fallback to basic English
        setLanguages([{
          code: 'en',
          name: 'English',
          nativeName: 'English',
          direction: 'ltr',
          isDefault: true,
          displayOrder: 1,
        }]);
      }
    };
    loadLanguages();
  }, [isSimulator]);

  // Load translations when language changes (skip for simulator, wait until determined)
  useEffect(() => {
    // Wait until we know if we're on simulator
    if (isSimulator === null) return;
    
    if (isSimulator) {
      setTranslations({});
      setIsLoading(false);
      return;
    }

    const loadTranslations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const bundle = await localizationApiService.getTranslationBundle(language);
        setTranslations(bundle);
      } catch (err) {
        console.error('Failed to load translations:', err);
        setError('Failed to load translations');
        // Keep previous translations if available
      } finally {
        setIsLoading(false);
      }
    };
    loadTranslations();
  }, [language, isSimulator]);

  // Set language and persist to storage
  const setLanguage = useCallback(async (code: string) => {
    if (code === language) return;
    
    localStorage.setItem(STORAGE_KEY, code);
    localizationApiService.invalidateLanguageCache(language);
    setLanguageState(code);
  }, [language]);

  // Translation function with parameter interpolation
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    // Try API translations first, then fall back to defaults
    let text = translations[key] || DEFAULT_TRANSLATIONS[key];
    
    // Return key if translation not found (for debugging)
    if (!text) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }

    // Interpolate parameters: {{paramName}} -> value
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value));
      });
    }

    return text;
  }, [translations]);

  // Refresh translations (for cache invalidation)
  const refreshTranslations = useCallback(async () => {
    localizationApiService.clearCache();
    setIsLoading(true);
    try {
      const bundle = await localizationApiService.getTranslationBundle(language);
      setTranslations(bundle);
    } catch (err) {
      console.error('Failed to refresh translations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  const value = useMemo<LocalizationContextValue>(() => ({
    language,
    languages,
    translations,
    isLoading,
    error,
    setLanguage,
    t,
    refreshTranslations,
  }), [language, languages, translations, isLoading, error, setLanguage, t, refreshTranslations]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

/**
 * Hook to access localization context
 */
export function useLocalization(): LocalizationContextValue {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
}

/**
 * Hook to get translation function only
 */
export function useTranslation() {
  const { t, language, isLoading } = useLocalization();
  return { t, language, isLoading };
}

/**
 * Hook to get languages and language setter
 */
export function useLanguage() {
  const { language, languages, setLanguage, isLoading } = useLocalization();
  return { language, languages, setLanguage, isLoading };
}
