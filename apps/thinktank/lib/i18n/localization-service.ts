/**
 * Localization API Service
 * 
 * ALL translations come from the Radiant API - NO direct data access.
 * This ensures Think Tank consumer app is fully decoupled from Radiant internals.
 */

import { api } from '@/lib/api/client';
import type { Language, TranslationBundle } from './types';

const LOCALIZATION_BASE = '/api/localization';

class LocalizationApiService {
  private bundleCache: Map<string, { data: TranslationBundle; expiresAt: number }> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour

  /**
   * Get supported languages from the API
   */
  async getLanguages(): Promise<Language[]> {
    const response = await api.get<{ languages: Language[] }>(`${LOCALIZATION_BASE}/languages`);
    return response.languages;
  }

  /**
   * Get translation bundle for a language
   * @param languageCode - Language code (e.g., 'en', 'es', 'fr')
   * @param category - Optional category filter (e.g., 'thinktank.chat')
   */
  async getTranslationBundle(languageCode: string, category?: string): Promise<TranslationBundle> {
    const cacheKey = `${languageCode}:${category || 'all'}`;
    const cached = this.bundleCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const params: Record<string, string> = { language: languageCode, appId: 'thinktank' };
    if (category) {
      params.category = category;
    }

    const response = await api.get<{ bundle: TranslationBundle }>(`${LOCALIZATION_BASE}/bundle`, params);
    
    // Cache the bundle
    this.bundleCache.set(cacheKey, {
      data: response.bundle,
      expiresAt: Date.now() + this.CACHE_TTL,
    });

    return response.bundle;
  }

  /**
   * Get a single translation
   */
  async getTranslation(key: string, languageCode: string): Promise<string> {
    const response = await api.get<{ text: string }>(`${LOCALIZATION_BASE}/translate`, {
      key,
      language: languageCode,
    });
    return response.text;
  }

  /**
   * Clear the translation cache (useful when language changes)
   */
  clearCache(): void {
    this.bundleCache.clear();
  }

  /**
   * Invalidate cache for a specific language
   */
  invalidateLanguageCache(languageCode: string): void {
    const keysToDelete: string[] = [];
    this.bundleCache.forEach((_, key) => {
      if (key.startsWith(languageCode)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.bundleCache.delete(key));
  }
}

export const localizationApiService = new LocalizationApiService();
