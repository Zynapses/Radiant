import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
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
  private bedrock: BedrockRuntimeClient;
  private bundleCache: Map<string, { data: Record<string, string>; expiresAt: number }> = new Map();

  constructor() {
    this.bedrock = new BedrockRuntimeClient({});
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

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
        contentType: 'application/json',
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.content?.[0]?.text?.trim() || text;
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
