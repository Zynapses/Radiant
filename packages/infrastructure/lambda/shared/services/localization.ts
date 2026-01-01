import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

type TranslationStatus = 'pending' | 'ai_translated' | 'needs_review' | 'approved' | 'rejected';

interface LocalizationEntry {
  key: string;
  defaultText: string;
  context?: string;
  category: string;
  placeholders?: string[];
}

interface Translation {
  key: string;
  languageCode: string;
  text: string;
  status: TranslationStatus;
}

export class LocalizationService {
  private sagemaker: SageMakerRuntimeClient;
  private bundleCache: Map<string, { data: Record<string, string>; expiresAt: number }> = new Map();
  private readonly TRANSLATION_ENDPOINT = process.env.QWEN_TRANSLATION_ENDPOINT || 'radiant-qwen25-7b-translation';

  constructor() {
    this.sagemaker = new SageMakerRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  async registerString(entry: LocalizationEntry): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO localization_registry 
       (key, default_text, context, category, placeholders)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO UPDATE SET 
         default_text = EXCLUDED.default_text,
         context = EXCLUDED.context,
         updated_at = NOW()
       RETURNING id`,
      [
        { name: 'key', value: { stringValue: entry.key } },
        { name: 'defaultText', value: { stringValue: entry.defaultText } },
        { name: 'context', value: entry.context ? { stringValue: entry.context } : { isNull: true } },
        { name: 'category', value: { stringValue: entry.category } },
        { name: 'placeholders', value: entry.placeholders ? { stringValue: `{${entry.placeholders.join(',')}}` } : { isNull: true } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>).id);
  }

  async getTranslation(key: string, languageCode: string): Promise<string> {
    // Check cache first
    const cacheKey = `${languageCode}:${key}`;
    const bundleCacheKey = `bundle:${languageCode}`;
    const cached = this.bundleCache.get(bundleCacheKey);
    
    if (cached && cached.expiresAt > Date.now() && cached.data[key]) {
      return cached.data[key];
    }

    const result = await executeStatement(
      `SELECT lt.translated_text, lr.default_text
       FROM localization_registry lr
       LEFT JOIN localization_translations lt ON lr.id = lt.registry_id AND lt.language_code = $2
       WHERE lr.key = $1`,
      [
        { name: 'key', value: { stringValue: key } },
        { name: 'languageCode', value: { stringValue: languageCode } },
      ]
    );

    if (result.rows.length === 0) return key;

    const row = result.rows[0] as Record<string, unknown>;
    return String(row.translated_text || row.default_text || key);
  }

  async getTranslationBundle(languageCode: string, category?: string, appId?: string): Promise<Record<string, string>> {
    const cacheKey = `bundle:${languageCode}:${category || 'all'}:${appId || 'all'}`;
    const cached = this.bundleCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    let sql = `
      SELECT lr.key, COALESCE(lt.translated_text, lr.default_text) as text
      FROM localization_registry lr
      LEFT JOIN localization_translations lt ON lr.id = lt.registry_id AND lt.language_code = $1
      WHERE lr.is_active = true`;
    
    const params: Array<{ name: string; value: { stringValue: string } }> = [
      { name: 'languageCode', value: { stringValue: languageCode } },
    ];

    if (category) {
      sql += ` AND lr.category = $${params.length + 1}`;
      params.push({ name: 'category', value: { stringValue: category } });
    }

    if (appId) {
      sql += ` AND (lr.app_id IS NULL OR lr.app_id = $${params.length + 1})`;
      params.push({ name: 'appId', value: { stringValue: appId } });
    }

    const result = await executeStatement(sql, params as Parameters<typeof executeStatement>[1]);

    const bundle: Record<string, string> = {};
    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      bundle[String(r.key)] = String(r.text);
    }

    // Cache for 1 hour
    this.bundleCache.set(cacheKey, { data: bundle, expiresAt: Date.now() + 3600000 });

    return bundle;
  }

  async setTranslation(
    key: string,
    languageCode: string,
    translatedText: string,
    status: TranslationStatus = 'pending',
    translatorType: 'human' | 'ai' | 'imported' = 'human'
  ): Promise<void> {
    // Get registry ID
    const registryResult = await executeStatement(
      `SELECT id FROM localization_registry WHERE key = $1`,
      [{ name: 'key', value: { stringValue: key } }]
    );

    if (registryResult.rows.length === 0) {
      throw new Error(`Localization key not found: ${key}`);
    }

    const registryId = String((registryResult.rows[0] as Record<string, unknown>).id);

    await executeStatement(
      `INSERT INTO localization_translations 
       (registry_id, language_code, translated_text, status, translator_type)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (registry_id, language_code) DO UPDATE SET 
         translated_text = EXCLUDED.translated_text,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      [
        { name: 'registryId', value: { stringValue: registryId } },
        { name: 'languageCode', value: { stringValue: languageCode } },
        { name: 'translatedText', value: { stringValue: translatedText } },
        { name: 'status', value: { stringValue: status } },
        { name: 'translatorType', value: { stringValue: translatorType } },
      ]
    );

    // Invalidate cache
    this.invalidateBundleCache(languageCode);
  }

  async approveTranslation(key: string, languageCode: string, reviewerId: string): Promise<void> {
    await executeStatement(
      `UPDATE localization_translations lt
       SET status = 'approved', reviewed_by = $3, reviewed_at = NOW()
       FROM localization_registry lr
       WHERE lt.registry_id = lr.id AND lr.key = $1 AND lt.language_code = $2`,
      [
        { name: 'key', value: { stringValue: key } },
        { name: 'languageCode', value: { stringValue: languageCode } },
        { name: 'reviewerId', value: { stringValue: reviewerId } },
      ]
    );

    this.invalidateBundleCache(languageCode);
  }

  async translateWithAI(key: string, targetLanguages: string[]): Promise<void> {
    // Get source text
    const registryResult = await executeStatement(
      `SELECT id, default_text, context FROM localization_registry WHERE key = $1`,
      [{ name: 'key', value: { stringValue: key } }]
    );

    if (registryResult.rows.length === 0) return;

    const registry = registryResult.rows[0] as Record<string, unknown>;
    const sourceText = String(registry.default_text);
    const context = registry.context ? String(registry.context) : '';

    for (const targetLang of targetLanguages) {
      try {
        const translatedText = await this.callTranslationAI(sourceText, 'en', targetLang, context);
        await this.setTranslation(key, targetLang, translatedText, 'ai_translated', 'ai');
      } catch (error) {
        logger.error('Failed to translate string', { key, targetLang, error });
      }
    }
  }

  async getTranslationStats(): Promise<{
    totalStrings: number;
    byLanguage: Record<string, { approved: number; pending: number; aiTranslated: number }>;
  }> {
    const totalResult = await executeStatement(
      `SELECT COUNT(*) as count FROM localization_registry WHERE is_active = true`,
      []
    );
    const totalStrings = parseInt(String((totalResult.rows[0] as Record<string, unknown>).count), 10);

    const statsResult = await executeStatement(
      `SELECT 
         lt.language_code,
         COUNT(*) FILTER (WHERE lt.status = 'approved') as approved,
         COUNT(*) FILTER (WHERE lt.status = 'pending') as pending,
         COUNT(*) FILTER (WHERE lt.status = 'ai_translated') as ai_translated
       FROM localization_translations lt
       GROUP BY lt.language_code`,
      []
    );

    const byLanguage: Record<string, { approved: number; pending: number; aiTranslated: number }> = {};
    for (const row of statsResult.rows) {
      const r = row as Record<string, unknown>;
      byLanguage[String(r.language_code)] = {
        approved: parseInt(String(r.approved), 10),
        pending: parseInt(String(r.pending), 10),
        aiTranslated: parseInt(String(r.ai_translated), 10),
      };
    }

    return { totalStrings, byLanguage };
  }

  async getSupportedLanguages(): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT code, name, native_name, direction, is_default, display_order 
       FROM localization_languages WHERE is_active = true ORDER BY display_order`,
      []
    );
    return result.rows;
  }

  /**
   * Call Qwen 2.5 7B via SageMaker for translation
   * Cost: $0.08/1M input, $0.24/1M output (3x cheaper than Claude Haiku)
   */
  private async callTranslationAI(
    text: string,
    sourceLang: string,
    targetLang: string,
    context: string
  ): Promise<string> {
    const prompt = `Translate the following text from ${sourceLang} to ${targetLang}.
${context ? `Context: ${context}` : ''}

Text to translate: "${text}"

Provide ONLY the translated text, nothing else.`;

    try {
      // Qwen 2.5 7B Instruct ChatML format
      const payload = {
        inputs: `<|im_start|>system
You are a professional translator. Translate accurately while preserving formatting.<|im_end|>
<|im_start|>user
${prompt}<|im_end|>
<|im_start|>assistant
`,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.3,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false,
        },
      };

      const response = await this.sagemaker.send(
        new InvokeEndpointCommand({
          EndpointName: this.TRANSLATION_ENDPOINT,
          ContentType: 'application/json',
          Body: JSON.stringify(payload),
        })
      );

      const responseBody = JSON.parse(new TextDecoder().decode(response.Body));

      // Handle different response formats from TGI/vLLM
      let translatedText: string;
      if (Array.isArray(responseBody)) {
        // TGI format: [{generated_text: "..."}]
        translatedText = responseBody[0]?.generated_text?.trim() || '';
      } else if (responseBody.generated_text) {
        // Single response format
        translatedText = responseBody.generated_text.trim();
      } else if (responseBody.choices) {
        // vLLM OpenAI-compatible format
        translatedText = responseBody.choices[0]?.text?.trim() || '';
      } else {
        translatedText = String(responseBody).trim();
      }

      // Clean up any trailing assistant tokens
      translatedText = translatedText.replace(/<\|im_end\|>/g, '').trim();

      return translatedText || text;
    } catch (error) {
      logger.error(`Qwen translation model call failed: ${String(error)}`);
      // Return original text on error
      return text;
    }
  }

  private invalidateBundleCache(languageCode: string): void {
    const keysToDelete: string[] = [];
    this.bundleCache.forEach((_, key) => {
      if (key.includes(languageCode)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.bundleCache.delete(key));
  }
}

export const localizationService = new LocalizationService();
