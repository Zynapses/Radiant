// RADIANT v4.18.0 - Translation Middleware Admin API
// Manages translation configuration, metrics, and model language capabilities

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement } from '../shared/db/client';
import { translationMiddlewareService } from '../shared/services/translation-middleware.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

interface TranslationConfig {
  enabled: boolean;
  translation_model: string;
  cache_enabled: boolean;
  cache_ttl_hours: number;
  max_cache_size: number;
  confidence_threshold: number;
  max_input_length: number;
  preserve_code_blocks: boolean;
  preserve_urls: boolean;
  preserve_mentions: boolean;
  fallback_to_english: boolean;
  cost_limit_per_day_cents: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

function getTenantId(event: APIGatewayProxyEvent): string {
  return event.requestContext.authorizer?.tenantId || 
         event.headers['x-tenant-id'] || 
         'default';
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/admin/translation/config
 * Get translation configuration for tenant
 */
async function getConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  
  const result = await executeStatement(
    `SELECT * FROM translation_config WHERE tenant_id = $1`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  if (result.rows.length === 0) {
    // Return default config
    return response(200, {
      config: {
        enabled: true,
        translation_model: 'qwen2.5-7b-instruct',
        cache_enabled: true,
        cache_ttl_hours: 168,
        max_cache_size: 10000,
        confidence_threshold: 0.70,
        max_input_length: 50000,
        preserve_code_blocks: true,
        preserve_urls: true,
        preserve_mentions: true,
        fallback_to_english: true,
        cost_limit_per_day_cents: 1000,
      },
      isDefault: true,
    });
  }
  
  return response(200, { config: result.rows[0], isDefault: false });
}

/**
 * PUT /api/admin/translation/config
 * Update translation configuration for tenant
 */
async function updateConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const body = JSON.parse(event.body || '{}') as Partial<TranslationConfig>;
  
  await executeStatement(
    `INSERT INTO translation_config (
      tenant_id, enabled, translation_model, cache_enabled, cache_ttl_hours,
      max_cache_size, confidence_threshold, max_input_length, preserve_code_blocks,
      preserve_urls, preserve_mentions, fallback_to_english, cost_limit_per_day_cents
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (tenant_id) DO UPDATE SET
      enabled = COALESCE($2, translation_config.enabled),
      translation_model = COALESCE($3, translation_config.translation_model),
      cache_enabled = COALESCE($4, translation_config.cache_enabled),
      cache_ttl_hours = COALESCE($5, translation_config.cache_ttl_hours),
      max_cache_size = COALESCE($6, translation_config.max_cache_size),
      confidence_threshold = COALESCE($7, translation_config.confidence_threshold),
      max_input_length = COALESCE($8, translation_config.max_input_length),
      preserve_code_blocks = COALESCE($9, translation_config.preserve_code_blocks),
      preserve_urls = COALESCE($10, translation_config.preserve_urls),
      preserve_mentions = COALESCE($11, translation_config.preserve_mentions),
      fallback_to_english = COALESCE($12, translation_config.fallback_to_english),
      cost_limit_per_day_cents = COALESCE($13, translation_config.cost_limit_per_day_cents),
      updated_at = NOW()`,
    [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'enabled', value: body.enabled !== undefined ? { booleanValue: body.enabled } : { isNull: true } },
      { name: 'translationModel', value: body.translation_model ? { stringValue: body.translation_model } : { isNull: true } },
      { name: 'cacheEnabled', value: body.cache_enabled !== undefined ? { booleanValue: body.cache_enabled } : { isNull: true } },
      { name: 'cacheTtlHours', value: body.cache_ttl_hours ? { longValue: body.cache_ttl_hours } : { isNull: true } },
      { name: 'maxCacheSize', value: body.max_cache_size ? { longValue: body.max_cache_size } : { isNull: true } },
      { name: 'confidenceThreshold', value: body.confidence_threshold ? { doubleValue: body.confidence_threshold } : { isNull: true } },
      { name: 'maxInputLength', value: body.max_input_length ? { longValue: body.max_input_length } : { isNull: true } },
      { name: 'preserveCodeBlocks', value: body.preserve_code_blocks !== undefined ? { booleanValue: body.preserve_code_blocks } : { isNull: true } },
      { name: 'preserveUrls', value: body.preserve_urls !== undefined ? { booleanValue: body.preserve_urls } : { isNull: true } },
      { name: 'preserveMentions', value: body.preserve_mentions !== undefined ? { booleanValue: body.preserve_mentions } : { isNull: true } },
      { name: 'fallbackToEnglish', value: body.fallback_to_english !== undefined ? { booleanValue: body.fallback_to_english } : { isNull: true } },
      { name: 'costLimitPerDayCents', value: body.cost_limit_per_day_cents ? { longValue: body.cost_limit_per_day_cents } : { isNull: true } },
    ]
  );
  
  logger.info('Translation config updated', { tenantId });
  return response(200, { success: true });
}

/**
 * GET /api/admin/translation/dashboard
 * Get translation dashboard with metrics and status
 */
async function getDashboard(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const days = parseInt(event.queryStringParameters?.days || '30', 10);
  
  // Get metrics
  const metrics = await translationMiddlewareService.getMetrics(tenantId, days);
  
  // Get config
  const configResult = await executeStatement(
    `SELECT * FROM translation_config WHERE tenant_id = $1`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  // Get cache stats
  const cacheResult = await executeStatement(
    `SELECT COUNT(*) as count, SUM(hit_count) as total_hits
     FROM translation_cache WHERE tenant_id = $1 AND expires_at > NOW()`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  // Get recent translations
  const recentResult = await executeStatement(
    `SELECT source_language, target_language, input_length, latency_ms, cached, created_at
     FROM translation_metrics WHERE tenant_id = $1
     ORDER BY created_at DESC LIMIT 10`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  const cacheStats = cacheResult.rows[0] as { count: number; total_hits: number } | undefined;
  
  return response(200, {
    config: configResult.rows[0] || null,
    metrics: {
      ...metrics,
      periodDays: days,
    },
    cache: {
      entriesCount: cacheStats?.count || 0,
      totalHits: cacheStats?.total_hits || 0,
    },
    recentTranslations: recentResult.rows,
  });
}

/**
 * GET /api/admin/translation/languages
 * Get all supported languages with model support matrix
 */
async function getLanguages(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Get all language matrices
  const result = await executeStatement(
    `SELECT 
       mlm.model_id,
       mlm.is_external,
       mlm.translate_threshold,
       mlc.language_code,
       mlc.support_level,
       mlc.quality_score
     FROM model_language_matrices mlm
     LEFT JOIN model_language_capabilities mlc ON mlm.id = mlc.matrix_id
     ORDER BY mlm.model_id, mlc.language_code`,
    []
  );
  
  // Group by model
  const byModel: Record<string, {
    modelId: string;
    isExternal: boolean;
    translateThreshold: string;
    languages: Array<{ code: string; level: string; score: number }>;
  }> = {};
  
  for (const row of result.rows) {
    const r = row as Record<string, unknown>;
    const modelId = r.model_id as string;
    
    if (!byModel[modelId]) {
      byModel[modelId] = {
        modelId,
        isExternal: r.is_external as boolean,
        translateThreshold: r.translate_threshold as string,
        languages: [],
      };
    }
    
    if (r.language_code) {
      byModel[modelId].languages.push({
        code: r.language_code as string,
        level: r.support_level as string,
        score: r.quality_score as number,
      });
    }
  }
  
  return response(200, {
    supportedLanguages: [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano' },
      { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
      { code: 'pl', name: 'Polish', nativeName: 'Polski' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' },
      { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' },
      { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
      { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
      { code: 'th', name: 'Thai', nativeName: 'ไทย' },
      { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
    ],
    modelSupport: Object.values(byModel),
  });
}

/**
 * POST /api/admin/translation/detect
 * Detect language of text
 */
async function detectLanguage(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const text = body.text as string;
  
  if (!text) {
    return response(400, { error: 'text is required' });
  }
  
  const result = await translationMiddlewareService.detectLanguage(text);
  return response(200, result);
}

/**
 * POST /api/admin/translation/translate
 * Translate text (for testing)
 */
async function translateText(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { text, sourceLanguage, targetLanguage, context, domain } = body;
  
  if (!text || !sourceLanguage || !targetLanguage) {
    return response(400, { error: 'text, sourceLanguage, and targetLanguage are required' });
  }
  
  const result = await translationMiddlewareService.translate({
    text,
    sourceLanguage,
    targetLanguage,
    context,
    domain,
    preserveFormatting: true,
  });
  
  return response(200, result);
}

/**
 * POST /api/admin/translation/check-model
 * Check if translation is required for a model + language
 */
async function checkModelLanguage(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { modelId, languageCode } = body;
  
  if (!modelId || !languageCode) {
    return response(400, { error: 'modelId and languageCode are required' });
  }
  
  const translationRequired = await translationMiddlewareService.isTranslationRequired(
    modelId,
    languageCode
  );
  
  // Get the capability details
  const result = await executeStatement(
    `SELECT mlc.support_level, mlc.quality_score, mlm.translate_threshold
     FROM model_language_capabilities mlc
     JOIN model_language_matrices mlm ON mlc.matrix_id = mlm.id
     WHERE mlm.model_id = $1 AND mlc.language_code = $2`,
    [
      { name: 'modelId', value: { stringValue: modelId } },
      { name: 'languageCode', value: { stringValue: languageCode } },
    ]
  );
  
  const capability = result.rows[0] as Record<string, unknown> | undefined;
  
  return response(200, {
    modelId,
    languageCode,
    translationRequired,
    capability: capability ? {
      supportLevel: capability.support_level,
      qualityScore: capability.quality_score,
      translateThreshold: capability.translate_threshold,
    } : null,
  });
}

/**
 * DELETE /api/admin/translation/cache
 * Clear translation cache for tenant
 */
async function clearCache(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  
  const result = await executeStatement(
    `DELETE FROM translation_cache WHERE tenant_id = $1`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  logger.info('Translation cache cleared', { tenantId });
  return response(200, { 
    success: true, 
    deletedCount: result.rowCount || 0,
  });
}

// ============================================================================
// Router
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path.replace(/^\/api\/admin\/translation\/?/, '');
  
  try {
    // GET endpoints
    if (method === 'GET') {
      if (path === 'config' || path === '') {
        return await getConfig(event);
      }
      if (path === 'dashboard') {
        return await getDashboard(event);
      }
      if (path === 'languages') {
        return await getLanguages(event);
      }
    }
    
    // PUT endpoints
    if (method === 'PUT') {
      if (path === 'config') {
        return await updateConfig(event);
      }
    }
    
    // POST endpoints
    if (method === 'POST') {
      if (path === 'detect') {
        return await detectLanguage(event);
      }
      if (path === 'translate') {
        return await translateText(event);
      }
      if (path === 'check-model') {
        return await checkModelLanguage(event);
      }
    }
    
    // DELETE endpoints
    if (method === 'DELETE') {
      if (path === 'cache') {
        return await clearCache(event);
      }
    }
    
    return response(404, { error: 'Not found' });
  } catch (error) {
    logger.error(`Translation API error: ${String(error)}`);
    return response(500, { error: 'Internal server error' });
  }
}
