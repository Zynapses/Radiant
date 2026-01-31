// RADIANT v5.2.1 - Translation Middleware Service
// Automatic translation layer for multilingual model routing
// Uses Qwen 2.5 7B for cost-effective translation ($0.08/$0.24 per 1M tokens)
// Now with resilience patterns: circuit breaker, retry, timeout

import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { callWithResilience } from './resilient-provider.service';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { createHash } from 'crypto';
import {
  LanguageCode,
  SUPPORTED_LANGUAGES,
  isValidLanguageCode,
} from '@radiant/shared';

// ============================================================================
// Types (inline to avoid circular deps, mirrors shared types)
// ============================================================================

type LanguageSupportLevel = 'native' | 'good' | 'moderate' | 'poor' | 'none';

interface TranslationRequest {
  text: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  context?: string;
  preserveFormatting?: boolean;
  domain?: string;
}

interface TranslationResult {
  translatedText: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  confidence: number;
  tokensUsed: { input: number; output: number };
  latencyMs: number;
  modelUsed: string;
  cached: boolean;
}

interface LanguageDetectionResult {
  detectedLanguage: LanguageCode;
  confidence: number;
  alternativeLanguages: Array<{ language: LanguageCode; confidence: number }>;
  isMultilingual: boolean;
  scriptType?: 'latin' | 'cyrillic' | 'arabic' | 'cjk' | 'devanagari' | 'thai' | 'other';
}

interface TranslationConfig {
  enabled: boolean;
  translationModel: string;
  cacheEnabled: boolean;
  cacheTTLHours: number;
  maxCacheSize: number;
  confidenceThreshold: number;
  maxInputLength: number;
  preserveCodeBlocks: boolean;
  preserveUrls: boolean;
  preserveMentions: boolean;
  fallbackToEnglish: boolean;
  costLimitPerDay: number;
}

interface TranslationContext {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  originalLanguage: LanguageCode;
  targetModelId: string;
  translationRequired: boolean;
  inputTranslation?: TranslationResult;
  outputTranslation?: TranslationResult;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: TranslationConfig = {
  enabled: true,
  translationModel: 'qwen2.5-7b-instruct',
  cacheEnabled: true,
  cacheTTLHours: 168, // 7 days
  maxCacheSize: 10000,
  confidenceThreshold: 0.7,
  maxInputLength: 50000,
  preserveCodeBlocks: true,
  preserveUrls: true,
  preserveMentions: true,
  fallbackToEnglish: true,
  costLimitPerDay: 1000, // $10/day
};

// Language detection patterns
const SCRIPT_PATTERNS: Record<string, RegExp> = {
  arabic: /[\u0600-\u06FF\u0750-\u077F]/,
  cjk: /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/,
  cyrillic: /[\u0400-\u04FF]/,
  devanagari: /[\u0900-\u097F]/,
  thai: /[\u0E00-\u0E7F]/,
  latin: /[a-zA-Z]/,
};

// Language-specific character patterns for detection
const LANGUAGE_PATTERNS: Record<string, { pattern: RegExp; weight: number }[]> = {
  'en': [{ pattern: /\b(the|is|are|was|were|have|has|been|will|would|could|should)\b/gi, weight: 1 }],
  'es': [{ pattern: /\b(el|la|los|las|es|son|está|están|que|por|para|con)\b/gi, weight: 1 }],
  'fr': [{ pattern: /\b(le|la|les|est|sont|que|pour|avec|dans|sur|être|avoir)\b/gi, weight: 1 }],
  'de': [{ pattern: /\b(der|die|das|ist|sind|ein|eine|und|mit|für|auf|aus)\b/gi, weight: 1 }],
  'pt': [{ pattern: /\b(o|a|os|as|é|são|que|para|com|por|em|de)\b/gi, weight: 1 }],
  'it': [{ pattern: /\b(il|la|lo|gli|le|è|sono|che|per|con|non|una)\b/gi, weight: 1 }],
  'nl': [{ pattern: /\b(de|het|een|is|zijn|van|voor|met|op|in|dat|niet)\b/gi, weight: 1 }],
  'pl': [{ pattern: /\b(jest|są|nie|tak|co|jak|dla|czy|już|może|być)\b/gi, weight: 1 }],
  'ru': [{ pattern: /\b(и|в|не|на|что|это|как|для|по|но|из|за)\b/gi, weight: 1 }],
  'tr': [{ pattern: /\b(ve|bir|bu|için|ile|da|de|ne|var|daha|çok)\b/gi, weight: 1 }],
  'ja': [{ pattern: /[\u3040-\u309F]/, weight: 2 }], // Hiragana
  'ko': [{ pattern: /[\uAC00-\uD7AF]/, weight: 2 }], // Hangul
  'zh-CN': [{ pattern: /[\u4E00-\u9FFF]/, weight: 1 }], // CJK (simplified detection by common chars)
  'zh-TW': [{ pattern: /[\u4E00-\u9FFF]/, weight: 1 }], // CJK (traditional detection by common chars)
  'ar': [{ pattern: /[\u0600-\u06FF]/, weight: 2 }],
  'hi': [{ pattern: /[\u0900-\u097F]/, weight: 2 }],
  'th': [{ pattern: /[\u0E00-\u0E7F]/, weight: 2 }],
  'vi': [{ pattern: /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi, weight: 2 }],
};

// ============================================================================
// Service Class
// ============================================================================

class TranslationMiddlewareService {
  private sagemaker: SageMakerRuntimeClient;
  private configCache: Map<string, { config: TranslationConfig; expiresAt: number }> = new Map();
  private translationCache: Map<string, { result: TranslationResult; expiresAt: number }> = new Map();
  private readonly TRANSLATION_ENDPOINT = process.env.QWEN_TRANSLATION_ENDPOINT || 'radiant-qwen25-7b-translation';

  constructor() {
    this.sagemaker = new SageMakerRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  // ==========================================================================
  // Language Detection
  // ==========================================================================

  /**
   * Detect the language of input text
   */
  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    const startTime = Date.now();
    
    // Detect script type first
    const scriptType = this.detectScript(text);
    
    // Score each language
    const scores: Record<string, number> = {};
    
    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      let score = 0;
      for (const { pattern, weight } of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          score += matches.length * weight;
        }
      }
      if (score > 0) {
        scores[lang] = score;
      }
    }
    
    // Special handling for CJK languages
    if (scriptType === 'cjk') {
      // Check for Japanese-specific characters (hiragana/katakana)
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
      const hasKorean = /[\uAC00-\uD7AF]/.test(text);
      
      if (hasJapanese) {
        scores['ja'] = (scores['ja'] || 0) + 100;
      } else if (hasKorean) {
        scores['ko'] = (scores['ko'] || 0) + 100;
      } else {
        // Default to Simplified Chinese, could be improved with more heuristics
        scores['zh-CN'] = (scores['zh-CN'] || 0) + 50;
      }
    }
    
    // Sort by score
    const sortedLangs = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .filter(([lang]) => isValidLanguageCode(lang));
    
    // Calculate confidence
    const totalScore = sortedLangs.reduce((sum, [, score]) => sum + score, 0);
    const topScore = sortedLangs[0]?.[1] || 0;
    const confidence = totalScore > 0 ? Math.min(0.99, topScore / totalScore + 0.3) : 0.5;
    
    // Determine if multilingual
    const isMultilingual = sortedLangs.length > 1 && 
      sortedLangs[1][1] > topScore * 0.3;
    
    const detectedLanguage = (sortedLangs[0]?.[0] as LanguageCode) || 'en';
    
    logger.debug('Language detection complete', {
      detectedLanguage,
      confidence,
      scriptType,
      topScores: sortedLangs.slice(0, 3),
      latencyMs: Date.now() - startTime,
    });
    
    return {
      detectedLanguage,
      confidence,
      alternativeLanguages: sortedLangs.slice(1, 4).map(([lang, score]) => ({
        language: lang as LanguageCode,
        confidence: totalScore > 0 ? score / totalScore : 0,
      })),
      isMultilingual,
      scriptType,
    };
  }

  /**
   * Detect the script type of text
   */
  private detectScript(text: string): 'latin' | 'cyrillic' | 'arabic' | 'cjk' | 'devanagari' | 'thai' | 'other' {
    const counts: Record<string, number> = {};
    
    for (const [script, pattern] of Object.entries(SCRIPT_PATTERNS)) {
      const matches = text.match(new RegExp(pattern, 'g'));
      counts[script] = matches?.length || 0;
    }
    
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
    const topScript = sorted[0]?.[0];
    
    if (topScript && counts[topScript] > 0) {
      return topScript as 'latin' | 'cyrillic' | 'arabic' | 'cjk' | 'devanagari' | 'thai';
    }
    
    return 'other';
  }

  // ==========================================================================
  // Translation
  // ==========================================================================

  /**
   * Translate text between languages
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.getCacheKey(request);
    const cached = this.translationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      logger.debug('Translation cache hit', { 
        sourceLanguage: request.sourceLanguage, 
        targetLanguage: request.targetLanguage 
      });
      return { ...cached.result, cached: true, latencyMs: Date.now() - startTime };
    }
    
    // Preserve special content
    const { processedText, replacements } = this.preserveSpecialContent(
      request.text,
      request.preserveFormatting ?? true
    );
    
    // Build translation prompt
    const prompt = this.buildTranslationPrompt(
      processedText,
      request.sourceLanguage,
      request.targetLanguage,
      request.context,
      request.domain
    );
    
    // Call translation model
    const response = await this.callTranslationModel(prompt);
    
    // Restore preserved content
    let translatedText = this.restoreSpecialContent(response.text, replacements);
    
    const result: TranslationResult = {
      translatedText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      confidence: response.confidence,
      tokensUsed: response.tokensUsed,
      latencyMs: Date.now() - startTime,
      modelUsed: 'qwen2.5-7b-instruct',
      cached: false,
    };
    
    // Cache result
    this.translationCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + (DEFAULT_CONFIG.cacheTTLHours * 60 * 60 * 1000),
    });
    
    // Log metrics
    await this.logTranslationMetrics(request, result);
    
    return result;
  }

  /**
   * Build the translation prompt
   */
  private buildTranslationPrompt(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
    context?: string,
    domain?: string
  ): string {
    const sourceLangName = SUPPORTED_LANGUAGES.find(l => l.code === sourceLanguage)?.name || sourceLanguage;
    const targetLangName = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage;
    
    let prompt = `Translate the following text from ${sourceLangName} to ${targetLangName}.`;
    
    if (context) {
      prompt += `\nContext: ${context}`;
    }
    
    if (domain) {
      prompt += `\nDomain: ${domain} (use appropriate terminology)`;
    }
    
    prompt += `\n\nIMPORTANT RULES:
1. Provide ONLY the translated text, no explanations
2. Preserve all formatting (markdown, code blocks, lists)
3. Keep placeholders like {{PLACEHOLDER}} unchanged
4. Maintain the tone and style of the original
5. For technical terms, use standard translations in the target language

Text to translate:
"""
${text}
"""

Translation:`;
    
    return prompt;
  }

  /**
   * Call Qwen 2.5 7B via SageMaker for translation
   * Cost: $0.08/1M input, $0.24/1M output (3x cheaper than Claude Haiku)
   */
  private async callTranslationModel(prompt: string): Promise<{
    text: string;
    confidence: number;
    tokensUsed: { input: number; output: number };
  }> {
    try {
      // Qwen 2.5 7B Instruct format
      const payload = {
        inputs: `<|im_start|>system
You are a professional translator. Translate accurately while preserving formatting.<|im_end|>
<|im_start|>user
${prompt}<|im_end|>
<|im_start|>assistant
`,
        parameters: {
          max_new_tokens: 4096,
          temperature: 0.3,  // Low temperature for accurate translation
          top_p: 0.9,
          do_sample: true,
          return_full_text: false,
        },
      };

      // Wrap SageMaker call with resilience
      const response = await callWithResilience(
        () => this.sagemaker.send(
          new InvokeEndpointCommand({
            EndpointName: this.TRANSLATION_ENDPOINT,
            ContentType: 'application/json',
            Body: JSON.stringify(payload),
          })
        ),
        {
          provider: 'sagemaker-translation',
          operation: 'translate',
          timeoutMs: 60000,
          maxRetries: 2,
        }
      );

      const responseBody = JSON.parse(new TextDecoder().decode(response.Body));
      
      // Handle different response formats from TGI/vLLM
      let text: string;
      let inputTokens = 0;
      let outputTokens = 0;

      if (Array.isArray(responseBody)) {
        // TGI format: [{generated_text: "..."}]
        text = responseBody[0]?.generated_text?.trim() || '';
      } else if (responseBody.generated_text) {
        // Single response format
        text = responseBody.generated_text.trim();
      } else if (responseBody.choices) {
        // vLLM OpenAI-compatible format
        text = responseBody.choices[0]?.text?.trim() || '';
        inputTokens = responseBody.usage?.prompt_tokens || 0;
        outputTokens = responseBody.usage?.completion_tokens || 0;
      } else {
        text = String(responseBody).trim();
      }

      // Clean up any trailing assistant tokens
      text = text.replace(/<\|im_end\|>/g, '').trim();

      // Estimate tokens if not provided (rough: 1 token ≈ 4 chars)
      if (!inputTokens) inputTokens = Math.ceil(prompt.length / 4);
      if (!outputTokens) outputTokens = Math.ceil(text.length / 4);

      return {
        text,
        confidence: 0.92, // Qwen 2.5 has excellent multilingual translation
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
        },
      };
    } catch (error) {
      logger.error(`Qwen translation model call failed: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Preserve code blocks, URLs, mentions before translation
   */
  private preserveSpecialContent(
    text: string,
    preserveFormatting: boolean
  ): { processedText: string; replacements: Map<string, string> } {
    const replacements = new Map<string, string>();
    let processedText = text;
    let counter = 0;
    
    if (!preserveFormatting) {
      return { processedText, replacements };
    }
    
    // Preserve code blocks
    processedText = processedText.replace(/```[\s\S]*?```/g, (match) => {
      const placeholder = `{{CODE_BLOCK_${counter++}}}`;
      replacements.set(placeholder, match);
      return placeholder;
    });
    
    // Preserve inline code
    processedText = processedText.replace(/`[^`]+`/g, (match) => {
      const placeholder = `{{INLINE_CODE_${counter++}}}`;
      replacements.set(placeholder, match);
      return placeholder;
    });
    
    // Preserve URLs
    processedText = processedText.replace(/https?:\/\/[^\s]+/g, (match) => {
      const placeholder = `{{URL_${counter++}}}`;
      replacements.set(placeholder, match);
      return placeholder;
    });
    
    // Preserve @mentions
    processedText = processedText.replace(/@[\w-]+/g, (match) => {
      const placeholder = `{{MENTION_${counter++}}}`;
      replacements.set(placeholder, match);
      return placeholder;
    });
    
    return { processedText, replacements };
  }

  /**
   * Restore preserved content after translation
   */
  private restoreSpecialContent(text: string, replacements: Map<string, string>): string {
    let result = text;
    
    for (const [placeholder, original] of Array.from(replacements)) {
      result = result.replace(placeholder, original);
    }
    
    return result;
  }

  /**
   * Get cache key for translation
   */
  private getCacheKey(request: TranslationRequest): string {
    const hash = createHash('sha256')
      .update(`${request.sourceLanguage}:${request.targetLanguage}:${request.text}`)
      .digest('hex')
      .substring(0, 32);
    return `trans:${hash}`;
  }

  /**
   * Log translation metrics to database
   */
  private async logTranslationMetrics(
    request: TranslationRequest,
    result: TranslationResult
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO translation_metrics 
         (source_language, target_language, input_length, output_length, 
          tokens_input, tokens_output, latency_ms, confidence, model_used, cached)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          { name: 'sourceLanguage', value: { stringValue: request.sourceLanguage } },
          { name: 'targetLanguage', value: { stringValue: request.targetLanguage } },
          { name: 'inputLength', value: { longValue: request.text.length } },
          { name: 'outputLength', value: { longValue: result.translatedText.length } },
          { name: 'tokensInput', value: { longValue: result.tokensUsed.input } },
          { name: 'tokensOutput', value: { longValue: result.tokensUsed.output } },
          { name: 'latencyMs', value: { longValue: result.latencyMs } },
          { name: 'confidence', value: { doubleValue: result.confidence } },
          { name: 'modelUsed', value: { stringValue: result.modelUsed } },
          { name: 'cached', value: { booleanValue: result.cached } },
        ]
      );
    } catch (error) {
      // Don't fail translation for metrics error
      logger.warn(`Failed to log translation metrics: ${String(error)}`);
    }
  }

  // ==========================================================================
  // Middleware Functions
  // ==========================================================================

  /**
   * Check if translation is required for a model + language combination
   */
  async isTranslationRequired(
    modelId: string,
    languageCode: LanguageCode
  ): Promise<boolean> {
    // Check model language matrix from database
    const result = await executeStatement(
      `SELECT quality_score, translate_threshold
       FROM model_language_capabilities mlc
       JOIN model_language_matrices mlm ON mlc.matrix_id = mlm.id
       WHERE mlm.model_id = $1 AND mlc.language_code = $2`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'languageCode', value: { stringValue: languageCode } },
      ]
    );
    
    if (result.rows.length === 0) {
      // Unknown model/language combo - translate to be safe
      return true;
    }
    
    const row = result.rows[0] as { quality_score: number; translate_threshold: number };
    return row.quality_score < row.translate_threshold;
  }

  /**
   * Process input through translation layer if needed
   */
  async processInput(
    tenantId: string,
    modelId: string,
    inputText: string,
    options?: {
      forceLanguage?: LanguageCode;
      context?: string;
      domain?: string;
    }
  ): Promise<TranslationContext> {
    // Detect input language
    const detection = options?.forceLanguage 
      ? { detectedLanguage: options.forceLanguage, confidence: 1.0, alternativeLanguages: [], isMultilingual: false }
      : await this.detectLanguage(inputText);
    
    const context: TranslationContext = {
      tenantId,
      originalLanguage: detection.detectedLanguage,
      targetModelId: modelId,
      translationRequired: false,
    };
    
    // Check if translation is required
    if (detection.detectedLanguage !== 'en') {
      context.translationRequired = await this.isTranslationRequired(
        modelId,
        detection.detectedLanguage
      );
    }
    
    // Translate if required
    if (context.translationRequired) {
      context.inputTranslation = await this.translate({
        text: inputText,
        sourceLanguage: detection.detectedLanguage,
        targetLanguage: 'en',
        context: options?.context,
        domain: options?.domain,
        preserveFormatting: true,
      });
      
      logger.info('Input translated for model processing', {
        tenantId,
        modelId,
        sourceLanguage: detection.detectedLanguage,
        inputLength: inputText.length,
        translatedLength: context.inputTranslation.translatedText.length,
      });
    }
    
    return context;
  }

  /**
   * Process output through translation layer if needed
   */
  async processOutput(
    context: TranslationContext,
    outputText: string,
    options?: {
      domain?: string;
    }
  ): Promise<string> {
    // Only translate back if we translated the input
    if (!context.translationRequired || context.originalLanguage === 'en') {
      return outputText;
    }
    
    // Translate output back to original language
    context.outputTranslation = await this.translate({
      text: outputText,
      sourceLanguage: 'en',
      targetLanguage: context.originalLanguage,
      domain: options?.domain,
      preserveFormatting: true,
    });
    
    logger.info('Output translated back to original language', {
      tenantId: context.tenantId,
      targetLanguage: context.originalLanguage,
      outputLength: outputText.length,
      translatedLength: context.outputTranslation.translatedText.length,
    });
    
    return context.outputTranslation.translatedText;
  }

  /**
   * Get the text to send to the model (translated or original)
   */
  getModelInput(context: TranslationContext, originalText: string): string {
    if (context.translationRequired && context.inputTranslation) {
      return context.inputTranslation.translatedText;
    }
    return originalText;
  }

  /**
   * Get translation metrics for a tenant
   */
  async getMetrics(tenantId: string, days: number = 30): Promise<{
    totalTranslations: number;
    byLanguagePair: Record<string, number>;
    totalTokens: { input: number; output: number };
    estimatedCost: number;
  }> {
    const result = await executeStatement(
      `SELECT 
         COUNT(*) as total,
         source_language,
         target_language,
         SUM(tokens_input) as total_input_tokens,
         SUM(tokens_output) as total_output_tokens
       FROM translation_metrics
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
       GROUP BY source_language, target_language`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    let totalTranslations = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const byLanguagePair: Record<string, number> = {};
    
    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      const count = Number(r.total);
      totalTranslations += count;
      totalInputTokens += Number(r.total_input_tokens);
      totalOutputTokens += Number(r.total_output_tokens);
      byLanguagePair[`${r.source_language}->${r.target_language}`] = count;
    }
    
    // Estimate cost using Qwen 2.5 7B pricing
    const inputCost = (totalInputTokens / 1_000_000) * 0.08;
    const outputCost = (totalOutputTokens / 1_000_000) * 0.24;
    
    return {
      totalTranslations,
      byLanguagePair,
      totalTokens: { input: totalInputTokens, output: totalOutputTokens },
      estimatedCost: inputCost + outputCost,
    };
  }
}

// Export singleton instance
export const translationMiddlewareService = new TranslationMiddlewareService();
