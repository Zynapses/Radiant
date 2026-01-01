// RADIANT v4.18.0 - Translation Middleware Types
// Automatic translation layer for multilingual model routing

import { LanguageCode } from './localization.types';

/**
 * Language support level for a model
 */
export type LanguageSupportLevel = 'native' | 'good' | 'moderate' | 'poor' | 'none';

/**
 * Language capability entry for a model
 */
export interface ModelLanguageCapability {
  languageCode: LanguageCode;
  supportLevel: LanguageSupportLevel;
  qualityScore: number; // 0-100, estimated output quality
  notes?: string;
}

/**
 * Model language support matrix
 */
export interface ModelLanguageMatrix {
  modelId: string;
  primaryLanguage: LanguageCode;
  capabilities: ModelLanguageCapability[];
  translateThreshold: LanguageSupportLevel; // Below this level, translate
}

/**
 * Translation request
 */
export interface TranslationRequest {
  text: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  context?: string; // Optional context for better translation
  preserveFormatting?: boolean; // Preserve markdown, code blocks, etc.
  domain?: string; // Domain hint for terminology
}

/**
 * Translation result
 */
export interface TranslationResult {
  translatedText: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  confidence: number; // 0-1
  tokensUsed: { input: number; output: number };
  latencyMs: number;
  modelUsed: string;
  cached: boolean;
}

/**
 * Language detection result
 */
export interface LanguageDetectionResult {
  detectedLanguage: LanguageCode;
  confidence: number; // 0-1
  alternativeLanguages: Array<{ language: LanguageCode; confidence: number }>;
  isMultilingual: boolean; // Text contains multiple languages
  scriptType?: 'latin' | 'cyrillic' | 'arabic' | 'cjk' | 'devanagari' | 'thai' | 'other';
}

/**
 * Translation middleware context
 */
export interface TranslationContext {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  originalLanguage: LanguageCode;
  targetModelId: string;
  translationRequired: boolean;
  inputTranslation?: TranslationResult;
  outputTranslation?: TranslationResult;
}

/**
 * Translation cache entry
 */
export interface TranslationCacheEntry {
  id: string;
  sourceHash: string; // Hash of source text + source lang + target lang
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  sourceText: string;
  translatedText: string;
  confidence: number;
  hitCount: number;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

/**
 * Translation metrics
 */
export interface TranslationMetrics {
  totalTranslations: number;
  cacheHits: number;
  cacheMisses: number;
  averageLatencyMs: number;
  byLanguagePair: Record<string, {
    count: number;
    averageConfidence: number;
    averageLatencyMs: number;
  }>;
  tokenUsage: {
    input: number;
    output: number;
    estimatedCost: number;
  };
}

/**
 * Translation configuration
 */
export interface TranslationConfig {
  enabled: boolean;
  translationModel: string; // Model to use for translation (e.g., 'qwen2.5-7b-instruct')
  cacheEnabled: boolean;
  cacheTTLHours: number;
  maxCacheSize: number; // Max entries per tenant
  confidenceThreshold: number; // Min confidence to accept translation
  maxInputLength: number; // Max characters to translate in one request
  preserveCodeBlocks: boolean; // Don't translate code
  preserveUrls: boolean; // Don't translate URLs
  preserveMentions: boolean; // Don't translate @mentions
  fallbackToEnglish: boolean; // If translation fails, try English
  costLimitPerDay: number; // Max translation cost per day (cents)
}

/**
 * Default translation configuration
 */
export const DEFAULT_TRANSLATION_CONFIG: TranslationConfig = {
  enabled: true,
  translationModel: 'qwen2.5-7b-instruct', // Cheapest with good multilingual
  cacheEnabled: true,
  cacheTTLHours: 168, // 7 days
  maxCacheSize: 10000,
  confidenceThreshold: 0.7,
  maxInputLength: 50000,
  preserveCodeBlocks: true,
  preserveUrls: true,
  preserveMentions: true,
  fallbackToEnglish: true,
  costLimitPerDay: 1000, // $10/day max
};

/**
 * Language support levels for models
 * Models with 'native' or 'good' support don't need translation
 */
export const LANGUAGE_SUPPORT_THRESHOLDS: Record<LanguageSupportLevel, number> = {
  native: 90,   // Quality score >= 90
  good: 75,     // Quality score >= 75
  moderate: 50, // Quality score >= 50
  poor: 25,     // Quality score >= 25
  none: 0,      // Quality score < 25
};

/**
 * Default model language matrices
 * Defines which languages each model supports natively
 */
export const MODEL_LANGUAGE_MATRICES: ModelLanguageMatrix[] = [
  // External models - excellent multilingual support
  {
    modelId: 'claude-3-5-sonnet',
    primaryLanguage: 'en',
    translateThreshold: 'none', // Never translate for Claude
    capabilities: [
      { languageCode: 'en', supportLevel: 'native', qualityScore: 100 },
      { languageCode: 'es', supportLevel: 'native', qualityScore: 95 },
      { languageCode: 'fr', supportLevel: 'native', qualityScore: 95 },
      { languageCode: 'de', supportLevel: 'native', qualityScore: 95 },
      { languageCode: 'pt', supportLevel: 'native', qualityScore: 93 },
      { languageCode: 'it', supportLevel: 'native', qualityScore: 93 },
      { languageCode: 'nl', supportLevel: 'native', qualityScore: 90 },
      { languageCode: 'pl', supportLevel: 'native', qualityScore: 90 },
      { languageCode: 'ru', supportLevel: 'native', qualityScore: 92 },
      { languageCode: 'tr', supportLevel: 'native', qualityScore: 88 },
      { languageCode: 'ja', supportLevel: 'native', qualityScore: 92 },
      { languageCode: 'ko', supportLevel: 'native', qualityScore: 90 },
      { languageCode: 'zh-CN', supportLevel: 'native', qualityScore: 92 },
      { languageCode: 'zh-TW', supportLevel: 'native', qualityScore: 90 },
      { languageCode: 'ar', supportLevel: 'good', qualityScore: 85 },
      { languageCode: 'hi', supportLevel: 'good', qualityScore: 82 },
      { languageCode: 'th', supportLevel: 'good', qualityScore: 80 },
      { languageCode: 'vi', supportLevel: 'good', qualityScore: 80 },
    ],
  },
  {
    modelId: 'gpt-4o',
    primaryLanguage: 'en',
    translateThreshold: 'none', // Never translate for GPT-4o
    capabilities: [
      { languageCode: 'en', supportLevel: 'native', qualityScore: 100 },
      { languageCode: 'es', supportLevel: 'native', qualityScore: 95 },
      { languageCode: 'fr', supportLevel: 'native', qualityScore: 95 },
      { languageCode: 'de', supportLevel: 'native', qualityScore: 95 },
      { languageCode: 'pt', supportLevel: 'native', qualityScore: 93 },
      { languageCode: 'it', supportLevel: 'native', qualityScore: 93 },
      { languageCode: 'nl', supportLevel: 'native', qualityScore: 90 },
      { languageCode: 'pl', supportLevel: 'native', qualityScore: 90 },
      { languageCode: 'ru', supportLevel: 'native', qualityScore: 92 },
      { languageCode: 'tr', supportLevel: 'native', qualityScore: 88 },
      { languageCode: 'ja', supportLevel: 'native', qualityScore: 92 },
      { languageCode: 'ko', supportLevel: 'native', qualityScore: 90 },
      { languageCode: 'zh-CN', supportLevel: 'native', qualityScore: 92 },
      { languageCode: 'zh-TW', supportLevel: 'native', qualityScore: 90 },
      { languageCode: 'ar', supportLevel: 'good', qualityScore: 85 },
      { languageCode: 'hi', supportLevel: 'good', qualityScore: 82 },
      { languageCode: 'th', supportLevel: 'good', qualityScore: 80 },
      { languageCode: 'vi', supportLevel: 'good', qualityScore: 80 },
    ],
  },
  // Qwen - excellent multilingual, especially Asian languages
  {
    modelId: 'qwen2.5-72b-instruct',
    primaryLanguage: 'en',
    translateThreshold: 'moderate', // Translate for poor/none
    capabilities: [
      { languageCode: 'en', supportLevel: 'native', qualityScore: 95 },
      { languageCode: 'zh-CN', supportLevel: 'native', qualityScore: 98 },
      { languageCode: 'zh-TW', supportLevel: 'native', qualityScore: 95 },
      { languageCode: 'ja', supportLevel: 'native', qualityScore: 90 },
      { languageCode: 'ko', supportLevel: 'good', qualityScore: 85 },
      { languageCode: 'es', supportLevel: 'good', qualityScore: 80 },
      { languageCode: 'fr', supportLevel: 'good', qualityScore: 80 },
      { languageCode: 'de', supportLevel: 'good', qualityScore: 78 },
      { languageCode: 'pt', supportLevel: 'good', qualityScore: 75 },
      { languageCode: 'it', supportLevel: 'moderate', qualityScore: 70 },
      { languageCode: 'ru', supportLevel: 'good', qualityScore: 75 },
      { languageCode: 'nl', supportLevel: 'moderate', qualityScore: 65 },
      { languageCode: 'pl', supportLevel: 'moderate', qualityScore: 60 },
      { languageCode: 'tr', supportLevel: 'moderate', qualityScore: 55 },
      { languageCode: 'ar', supportLevel: 'moderate', qualityScore: 60 },
      { languageCode: 'hi', supportLevel: 'poor', qualityScore: 45 },
      { languageCode: 'th', supportLevel: 'poor', qualityScore: 40 },
      { languageCode: 'vi', supportLevel: 'moderate', qualityScore: 55 },
    ],
  },
  // Mistral - excellent European languages
  {
    modelId: 'mistral-large-2411',
    primaryLanguage: 'en',
    translateThreshold: 'moderate',
    capabilities: [
      { languageCode: 'en', supportLevel: 'native', qualityScore: 95 },
      { languageCode: 'fr', supportLevel: 'native', qualityScore: 95 },
      { languageCode: 'de', supportLevel: 'native', qualityScore: 92 },
      { languageCode: 'es', supportLevel: 'native', qualityScore: 90 },
      { languageCode: 'it', supportLevel: 'good', qualityScore: 85 },
      { languageCode: 'pt', supportLevel: 'good', qualityScore: 82 },
      { languageCode: 'nl', supportLevel: 'good', qualityScore: 80 },
      { languageCode: 'pl', supportLevel: 'moderate', qualityScore: 70 },
      { languageCode: 'ru', supportLevel: 'good', qualityScore: 75 },
      { languageCode: 'tr', supportLevel: 'moderate', qualityScore: 55 },
      { languageCode: 'ja', supportLevel: 'moderate', qualityScore: 60 },
      { languageCode: 'ko', supportLevel: 'moderate', qualityScore: 55 },
      { languageCode: 'zh-CN', supportLevel: 'moderate', qualityScore: 55 },
      { languageCode: 'zh-TW', supportLevel: 'moderate', qualityScore: 50 },
      { languageCode: 'ar', supportLevel: 'poor', qualityScore: 40 },
      { languageCode: 'hi', supportLevel: 'poor', qualityScore: 35 },
      { languageCode: 'th', supportLevel: 'poor', qualityScore: 30 },
      { languageCode: 'vi', supportLevel: 'poor', qualityScore: 35 },
    ],
  },
  // Llama 3.3 70B - good English, moderate others
  {
    modelId: 'llama-3.3-70b-instruct',
    primaryLanguage: 'en',
    translateThreshold: 'good', // Translate for moderate/poor/none
    capabilities: [
      { languageCode: 'en', supportLevel: 'native', qualityScore: 98 },
      { languageCode: 'es', supportLevel: 'good', qualityScore: 78 },
      { languageCode: 'fr', supportLevel: 'good', qualityScore: 78 },
      { languageCode: 'de', supportLevel: 'good', qualityScore: 75 },
      { languageCode: 'pt', supportLevel: 'moderate', qualityScore: 70 },
      { languageCode: 'it', supportLevel: 'moderate', qualityScore: 68 },
      { languageCode: 'nl', supportLevel: 'moderate', qualityScore: 60 },
      { languageCode: 'pl', supportLevel: 'moderate', qualityScore: 55 },
      { languageCode: 'ru', supportLevel: 'moderate', qualityScore: 60 },
      { languageCode: 'tr', supportLevel: 'poor', qualityScore: 45 },
      { languageCode: 'ja', supportLevel: 'moderate', qualityScore: 55 },
      { languageCode: 'ko', supportLevel: 'moderate', qualityScore: 50 },
      { languageCode: 'zh-CN', supportLevel: 'moderate', qualityScore: 55 },
      { languageCode: 'zh-TW', supportLevel: 'moderate', qualityScore: 50 },
      { languageCode: 'ar', supportLevel: 'poor', qualityScore: 40 },
      { languageCode: 'hi', supportLevel: 'poor', qualityScore: 35 },
      { languageCode: 'th', supportLevel: 'poor', qualityScore: 30 },
      { languageCode: 'vi', supportLevel: 'poor', qualityScore: 35 },
    ],
  },
  // Small models (7B-8B) - English-centric, translate everything else
  {
    modelId: 'llama-3.2-8b-instruct',
    primaryLanguage: 'en',
    translateThreshold: 'native', // Translate for all non-native
    capabilities: [
      { languageCode: 'en', supportLevel: 'native', qualityScore: 90 },
      { languageCode: 'es', supportLevel: 'moderate', qualityScore: 55 },
      { languageCode: 'fr', supportLevel: 'moderate', qualityScore: 55 },
      { languageCode: 'de', supportLevel: 'moderate', qualityScore: 50 },
      { languageCode: 'pt', supportLevel: 'poor', qualityScore: 45 },
      { languageCode: 'it', supportLevel: 'poor', qualityScore: 45 },
      { languageCode: 'nl', supportLevel: 'poor', qualityScore: 35 },
      { languageCode: 'pl', supportLevel: 'poor', qualityScore: 30 },
      { languageCode: 'ru', supportLevel: 'poor', qualityScore: 40 },
      { languageCode: 'tr', supportLevel: 'poor', qualityScore: 25 },
      { languageCode: 'ja', supportLevel: 'poor', qualityScore: 35 },
      { languageCode: 'ko', supportLevel: 'poor', qualityScore: 30 },
      { languageCode: 'zh-CN', supportLevel: 'poor', qualityScore: 35 },
      { languageCode: 'zh-TW', supportLevel: 'poor', qualityScore: 30 },
      { languageCode: 'ar', supportLevel: 'none', qualityScore: 20 },
      { languageCode: 'hi', supportLevel: 'none', qualityScore: 15 },
      { languageCode: 'th', supportLevel: 'none', qualityScore: 10 },
      { languageCode: 'vi', supportLevel: 'none', qualityScore: 15 },
    ],
  },
  // Qwen 7B - good for translation itself
  {
    modelId: 'qwen2.5-7b-instruct',
    primaryLanguage: 'en',
    translateThreshold: 'good',
    capabilities: [
      { languageCode: 'en', supportLevel: 'native', qualityScore: 88 },
      { languageCode: 'zh-CN', supportLevel: 'native', qualityScore: 92 },
      { languageCode: 'zh-TW', supportLevel: 'good', qualityScore: 85 },
      { languageCode: 'ja', supportLevel: 'good', qualityScore: 78 },
      { languageCode: 'ko', supportLevel: 'moderate', qualityScore: 65 },
      { languageCode: 'es', supportLevel: 'good', qualityScore: 72 },
      { languageCode: 'fr', supportLevel: 'good', qualityScore: 72 },
      { languageCode: 'de', supportLevel: 'moderate', qualityScore: 68 },
      { languageCode: 'pt', supportLevel: 'moderate', qualityScore: 65 },
      { languageCode: 'it', supportLevel: 'moderate', qualityScore: 60 },
      { languageCode: 'ru', supportLevel: 'moderate', qualityScore: 62 },
      { languageCode: 'nl', supportLevel: 'moderate', qualityScore: 55 },
      { languageCode: 'pl', supportLevel: 'poor', qualityScore: 45 },
      { languageCode: 'tr', supportLevel: 'poor', qualityScore: 42 },
      { languageCode: 'ar', supportLevel: 'moderate', qualityScore: 50 },
      { languageCode: 'hi', supportLevel: 'poor', qualityScore: 38 },
      { languageCode: 'th', supportLevel: 'poor', qualityScore: 35 },
      { languageCode: 'vi', supportLevel: 'moderate', qualityScore: 48 },
    ],
  },
];

/**
 * Get language support for a model
 */
export function getModelLanguageSupport(
  modelId: string,
  languageCode: LanguageCode
): ModelLanguageCapability | null {
  const matrix = MODEL_LANGUAGE_MATRICES.find(m => m.modelId === modelId);
  if (!matrix) return null;
  return matrix.capabilities.find(c => c.languageCode === languageCode) || null;
}

/**
 * Check if translation is required for a model + language combination
 */
export function isTranslationRequired(
  modelId: string,
  languageCode: LanguageCode
): boolean {
  const matrix = MODEL_LANGUAGE_MATRICES.find(m => m.modelId === modelId);
  if (!matrix) return true; // Unknown model, translate to be safe
  
  const capability = matrix.capabilities.find(c => c.languageCode === languageCode);
  if (!capability) return true; // Unknown language for this model
  
  const thresholdScore = LANGUAGE_SUPPORT_THRESHOLDS[matrix.translateThreshold];
  return capability.qualityScore < thresholdScore;
}
