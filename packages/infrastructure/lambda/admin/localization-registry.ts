/**
 * RADIANT v4.18.0 - Localization Registry Admin API
 * 
 * Manages:
 * - Translation registry entries (system-wide strings)
 * - Tenant translation overrides with protection flags
 * - Translation bundles for apps
 * - Tenant localization configuration
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam, boolParam } from '../shared/db/client';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

interface RegistryEntry {
  id: number;
  key: string;
  default_text: string;
  context?: string;
  category: string;
  app_id: string;
  placeholders?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TranslationOverride {
  id: string;
  tenant_id: string;
  registry_id: number;
  language_code: string;
  override_text: string;
  is_protected: boolean;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

interface TenantLocalizationConfig {
  id: string;
  tenant_id: string;
  default_language: string;
  enabled_languages: string[];
  allow_user_language_selection: boolean;
  enable_ai_translation: boolean;
  brand_name?: string;
}

type AppId = 'radiant_admin' | 'thinktank_admin' | 'thinktank' | 'curator' | 'common';

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

function getTenantId(event: { requestContext?: { authorizer?: { tenantId?: string } }; headers?: Record<string, string> }): string {
  return event.requestContext?.authorizer?.tenantId || 
         event.headers?.['x-tenant-id'] || 
         'default';
}

function getUserId(event: { requestContext?: { authorizer?: { userId?: string } }; headers?: Record<string, string> }): string {
  return event.requestContext?.authorizer?.userId || 
         event.headers?.['x-user-id'] || 
         'system';
}

// ============================================================================
// Registry Endpoints
// ============================================================================

/**
 * GET /api/admin/localization/registry
 * List all registry entries with optional filtering
 */
export const listRegistry: APIGatewayProxyHandler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const appId = params.app_id as AppId | undefined;
    const category = params.category;
    const search = params.search;
    const page = parseInt(params.page || '1');
    const limit = Math.min(parseInt(params.limit || '50'), 200);
    const offset = (page - 1) * limit;

    let whereConditions = ['is_active = TRUE'];
    const queryParams: { name: string; value: { stringValue: string } }[] = [];
    let paramIndex = 1;

    if (appId) {
      whereConditions.push(`app_id = $${paramIndex}`);
      queryParams.push({ name: `p${paramIndex}`, value: { stringValue: appId } });
      paramIndex++;
    }

    if (category) {
      whereConditions.push(`category = $${paramIndex}`);
      queryParams.push({ name: `p${paramIndex}`, value: { stringValue: category } });
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(key ILIKE $${paramIndex} OR default_text ILIKE $${paramIndex})`);
      queryParams.push({ name: `p${paramIndex}`, value: { stringValue: `%${search}%` } });
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await executeStatement(
      `SELECT COUNT(*) as count FROM localization_registry ${whereClause}`,
      queryParams
    );
    const totalCount = parseInt((countResult.rows?.[0] as any)?.count || '0');

    // Get entries
    const result = await executeStatement(
      `SELECT id, key, default_text, context, category, app_id, placeholders, is_active, created_at, updated_at
       FROM localization_registry
       ${whereClause}
       ORDER BY app_id, category, key
       LIMIT ${limit} OFFSET ${offset}`,
      queryParams
    );

    // Get unique categories for filtering
    const categoriesResult = await executeStatement(
      `SELECT DISTINCT category FROM localization_registry WHERE is_active = TRUE ORDER BY category`,
      []
    );

    return response(200, {
      success: true,
      data: {
        entries: result.rows || [],
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
        categories: (categoriesResult.rows || []).map((r: { category: string }) => r.category),
      },
    });
  } catch (error) {
    logger.error('Error listing registry', { error });
    return response(500, { success: false, error: 'Failed to list registry entries' });
  }
};

/**
 * GET /api/admin/localization/registry/:id
 * Get single registry entry with all translations
 */
export const getRegistryEntry: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return response(400, { success: false, error: 'Registry ID required' });
    }

    const tenantId = getTenantId(event);

    // Get registry entry
    const entryResult = await executeStatement(
      `SELECT id, key, default_text, context, category, app_id, placeholders, is_active, created_at, updated_at
       FROM localization_registry WHERE id = $1`,
      [{ name: 'id', value: { stringValue: id } }]
    );

    if (!entryResult.rows?.length) {
      return response(404, { success: false, error: 'Registry entry not found' });
    }

    // Get all system translations for this entry
    const translationsResult = await executeStatement(
      `SELECT language_code, translated_text, is_machine_translated, reviewed_at, reviewed_by
       FROM localization_translations WHERE registry_id = $1`,
      [{ name: 'id', value: { stringValue: id } }]
    );

    // Get tenant overrides for this entry
    const overridesResult = await executeStatement(
      `SELECT id, language_code, override_text, is_protected, created_by, updated_by, created_at, updated_at
       FROM tenant_translation_overrides 
       WHERE registry_id = $1 AND tenant_id = $2`,
      [
        { name: 'registryId', value: { stringValue: id } },
        { name: 'tenantId', value: { stringValue: tenantId } },
      ]
    );

    return response(200, {
      success: true,
      data: {
        entry: entryResult.rows[0],
        translations: translationsResult.rows || [],
        overrides: overridesResult.rows || [],
      },
    });
  } catch (error) {
    logger.error('Error getting registry entry', { error });
    return response(500, { success: false, error: 'Failed to get registry entry' });
  }
};

// ============================================================================
// Override Endpoints
// ============================================================================

/**
 * GET /api/admin/localization/overrides
 * List all tenant translation overrides
 */
export const listOverrides: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const params = event.queryStringParameters || {};
    const languageCode = params.language_code;
    const protectedOnly = params.protected === 'true';

    let whereConditions = ['tto.tenant_id = $1'];
    const queryParams: { name: string; value: { stringValue: string } }[] = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];
    let paramIndex = 2;

    if (languageCode) {
      whereConditions.push(`tto.language_code = $${paramIndex}`);
      queryParams.push({ name: `p${paramIndex}`, value: { stringValue: languageCode } });
      paramIndex++;
    }

    if (protectedOnly) {
      whereConditions.push(`tto.is_protected = TRUE`);
    }

    const result = await executeStatement(
      `SELECT 
        tto.id,
        tto.registry_id,
        tto.language_code,
        tto.override_text,
        tto.is_protected,
        tto.created_by,
        tto.updated_by,
        tto.created_at,
        tto.updated_at,
        lr.key,
        lr.default_text,
        lr.category,
        lr.app_id
       FROM tenant_translation_overrides tto
       JOIN localization_registry lr ON lr.id = tto.registry_id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY lr.app_id, lr.category, lr.key, tto.language_code`,
      queryParams
    );

    return response(200, {
      success: true,
      data: {
        overrides: result.rows || [],
        count: result.rows?.length || 0,
      },
    });
  } catch (error) {
    logger.error('Error listing overrides', { error });
    return response(500, { success: false, error: 'Failed to list overrides' });
  }
};

/**
 * POST /api/admin/localization/overrides
 * Create or update a tenant translation override
 */
export const upsertOverride: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const body = JSON.parse(event.body || '{}');

    const { registry_id, language_code, override_text, is_protected = true } = body;

    if (!registry_id || !language_code || !override_text) {
      return response(400, { 
        success: false, 
        error: 'registry_id, language_code, and override_text are required' 
      });
    }

    // Verify registry entry exists
    const entryResult = await executeStatement(
      `SELECT id, key FROM localization_registry WHERE id = $1 AND is_active = TRUE`,
      [{ name: 'id', value: { stringValue: String(registry_id) } }]
    );

    if (!entryResult.rows?.length) {
      return response(404, { success: false, error: 'Registry entry not found' });
    }

    // Check if override exists
    const existingResult = await executeStatement(
      `SELECT id, override_text FROM tenant_translation_overrides 
       WHERE tenant_id = $1 AND registry_id = $2 AND language_code = $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'registryId', value: { stringValue: String(registry_id) } },
        { name: 'languageCode', value: { stringValue: language_code } },
      ]
    );

    let result;
    let action: string;

    if (existingResult.rows?.length) {
      // Update existing override
      const oldValue = existingResult.rows[0].override_text;
      result = await executeStatement(
        `UPDATE tenant_translation_overrides 
         SET override_text = $1, is_protected = $2, updated_by = $3, updated_at = NOW()
         WHERE tenant_id = $4 AND registry_id = $5 AND language_code = $6
         RETURNING *`,
        [
          { name: 'text', value: { stringValue: override_text } },
          { name: 'protected', value: { stringValue: String(is_protected) } },
          { name: 'userId', value: { stringValue: userId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'registryId', value: { stringValue: String(registry_id) } },
          { name: 'languageCode', value: { stringValue: language_code } },
        ]
      );
      action = 'override_updated';

      // Log audit
      await executeStatement(
        `INSERT INTO translation_audit_log (tenant_id, registry_id, language_code, action, old_value, new_value, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'registryId', value: { stringValue: String(registry_id) } },
          { name: 'languageCode', value: { stringValue: language_code } },
          { name: 'action', value: { stringValue: action } },
          { name: 'oldValue', value: { stringValue: oldValue } },
          { name: 'newValue', value: { stringValue: override_text } },
          { name: 'userId', value: { stringValue: userId } },
        ]
      );
    } else {
      // Create new override
      result = await executeStatement(
        `INSERT INTO tenant_translation_overrides 
         (tenant_id, registry_id, language_code, override_text, is_protected, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         RETURNING *`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'registryId', value: { stringValue: String(registry_id) } },
          { name: 'languageCode', value: { stringValue: language_code } },
          { name: 'text', value: { stringValue: override_text } },
          { name: 'protected', value: { stringValue: String(is_protected) } },
          { name: 'userId', value: { stringValue: userId } },
        ]
      );
      action = 'override_created';

      // Log audit
      await executeStatement(
        `INSERT INTO translation_audit_log (tenant_id, registry_id, language_code, action, new_value, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'registryId', value: { stringValue: String(registry_id) } },
          { name: 'languageCode', value: { stringValue: language_code } },
          { name: 'action', value: { stringValue: action } },
          { name: 'newValue', value: { stringValue: override_text } },
          { name: 'userId', value: { stringValue: userId } },
        ]
      );
    }

    return response(200, {
      success: true,
      data: result.rows?.[0],
      message: action === 'override_created' ? 'Override created' : 'Override updated',
    });
  } catch (error) {
    logger.error('Error upserting override', { error });
    return response(500, { success: false, error: 'Failed to save override' });
  }
};

/**
 * DELETE /api/admin/localization/overrides/:id
 * Delete a tenant translation override (revert to system translation)
 */
export const deleteOverride: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const id = event.pathParameters?.id;

    if (!id) {
      return response(400, { success: false, error: 'Override ID required' });
    }

    // Get override details for audit
    const overrideResult = await executeStatement(
      `SELECT registry_id, language_code, override_text 
       FROM tenant_translation_overrides 
       WHERE id = $1 AND tenant_id = $2`,
      [
        { name: 'id', value: { stringValue: id } },
        { name: 'tenantId', value: { stringValue: tenantId } },
      ]
    );

    if (!overrideResult.rows?.length) {
      return response(404, { success: false, error: 'Override not found' });
    }

    const override = overrideResult.rows[0];

    // Delete override
    await executeStatement(
      `DELETE FROM tenant_translation_overrides WHERE id = $1 AND tenant_id = $2`,
      [
        { name: 'id', value: { stringValue: id } },
        { name: 'tenantId', value: { stringValue: tenantId } },
      ]
    );

    // Log audit
    await executeStatement(
      `INSERT INTO translation_audit_log (tenant_id, registry_id, language_code, action, old_value, performed_by)
       VALUES ($1, $2, $3, 'override_deleted', $4, $5)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'registryId', value: { stringValue: String(override.registry_id) } },
        { name: 'languageCode', value: { stringValue: override.language_code } },
        { name: 'oldValue', value: { stringValue: override.override_text } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    return response(200, {
      success: true,
      message: 'Override deleted, reverted to system translation',
    });
  } catch (error) {
    logger.error('Error deleting override', { error });
    return response(500, { success: false, error: 'Failed to delete override' });
  }
};

/**
 * PATCH /api/admin/localization/overrides/:id/protection
 * Toggle protection status of an override
 */
export const toggleProtection: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const id = event.pathParameters?.id;
    const body = JSON.parse(event.body || '{}');

    if (!id) {
      return response(400, { success: false, error: 'Override ID required' });
    }

    const { is_protected } = body;
    if (typeof is_protected !== 'boolean') {
      return response(400, { success: false, error: 'is_protected boolean required' });
    }

    // Update protection status
    const result = await executeStatement(
      `UPDATE tenant_translation_overrides 
       SET is_protected = $1, updated_by = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [
        { name: 'protected', value: { stringValue: String(is_protected) } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'id', value: { stringValue: id } },
        { name: 'tenantId', value: { stringValue: tenantId } },
      ]
    );

    if (!result.rows?.length) {
      return response(404, { success: false, error: 'Override not found' });
    }

    // Log audit
    await executeStatement(
      `INSERT INTO translation_audit_log (tenant_id, registry_id, language_code, action, performed_by, metadata)
       VALUES ($1, $2, $3, 'protection_toggled', $4, $5)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'registryId', value: { stringValue: String(result.rows[0].registry_id) } },
        { name: 'languageCode', value: { stringValue: result.rows[0].language_code } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'metadata', value: { stringValue: JSON.stringify({ is_protected }) } },
      ]
    );

    return response(200, {
      success: true,
      data: result.rows[0],
      message: is_protected 
        ? 'Override protected from automatic updates' 
        : 'Override will be updated by automatic translation',
    });
  } catch (error) {
    logger.error('Error toggling protection', { error });
    return response(500, { success: false, error: 'Failed to toggle protection' });
  }
};

// ============================================================================
// Bundle Endpoints
// ============================================================================

/**
 * GET /api/admin/localization/bundle/:languageCode
 * Get translation bundle for a language (with tenant overrides applied)
 */
export const getBundle: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const languageCode = event.pathParameters?.languageCode || 'en';
    const params = event.queryStringParameters || {};
    const appId = params.app_id as AppId | undefined;
    const category = params.category;

    let appIdParam = appId || null;
    let categoryParam = category || null;

    const result = await executeStatement(
      `SELECT * FROM get_translation_bundle($1, $2, $3, $4)`,
      [
        { name: 'languageCode', value: { stringValue: languageCode } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'appId', value: appIdParam ? { stringValue: appIdParam } : { isNull: true } },
        { name: 'category', value: categoryParam ? { stringValue: categoryParam } : { isNull: true } },
      ]
    );

    // Convert to key-value map
    const translations: Record<string, string> = {};
    const overrideKeys: string[] = [];
    
    for (const row of (result.rows || []) as any[]) {
      translations[row.key] = row.text;
      if (row.is_override) {
        overrideKeys.push(row.key);
      }
    }

    return response(200, {
      success: true,
      data: {
        languageCode,
        tenantId,
        appId: appId || 'all',
        category: category || 'all',
        translations,
        overrideCount: overrideKeys.length,
        overrideKeys,
        entryCount: Object.keys(translations).length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting bundle', { error });
    return response(500, { success: false, error: 'Failed to get translation bundle' });
  }
};

// ============================================================================
// Config Endpoints
// ============================================================================

/**
 * GET /api/admin/localization/config
 * Get tenant localization configuration
 */
export const getConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);

    const result = await executeStatement(
      `SELECT * FROM tenant_localization_config WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (!result.rows?.length) {
      // Return default config
      return response(200, {
        success: true,
        data: {
          tenant_id: tenantId,
          default_language: 'en',
          enabled_languages: ['en'],
          allow_user_language_selection: true,
          enable_ai_translation: true,
          brand_name: null,
        },
        isDefault: true,
      });
    }

    return response(200, {
      success: true,
      data: result.rows[0],
      isDefault: false,
    });
  } catch (error) {
    logger.error('Error getting config', { error });
    return response(500, { success: false, error: 'Failed to get localization config' });
  }
};

/**
 * PUT /api/admin/localization/config
 * Update tenant localization configuration
 */
export const updateConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body || '{}');

    const {
      default_language = 'en',
      enabled_languages = ['en'],
      allow_user_language_selection = true,
      enable_ai_translation = true,
      brand_name,
    } = body;

    const result = await executeStatement(
      `INSERT INTO tenant_localization_config 
       (tenant_id, default_language, enabled_languages, allow_user_language_selection, enable_ai_translation, brand_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id) DO UPDATE SET
         default_language = EXCLUDED.default_language,
         enabled_languages = EXCLUDED.enabled_languages,
         allow_user_language_selection = EXCLUDED.allow_user_language_selection,
         enable_ai_translation = EXCLUDED.enable_ai_translation,
         brand_name = EXCLUDED.brand_name,
         updated_at = NOW()
       RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'defaultLang', value: { stringValue: default_language } },
        { name: 'enabledLangs', value: { stringValue: `{${enabled_languages.join(',')}}` } },
        { name: 'allowSelection', value: { stringValue: String(allow_user_language_selection) } },
        { name: 'enableAi', value: { stringValue: String(enable_ai_translation) } },
        { name: 'brandName', value: brand_name ? { stringValue: brand_name } : { isNull: true } },
      ]
    );

    return response(200, {
      success: true,
      data: result.rows?.[0],
      message: 'Localization config updated',
    });
  } catch (error) {
    logger.error('Error updating config', { error });
    return response(500, { success: false, error: 'Failed to update localization config' });
  }
};

// ============================================================================
// Statistics Endpoint
// ============================================================================

/**
 * GET /api/admin/localization/stats
 * Get localization statistics
 */
export const getStats: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);

    // Get total registry entries
    const registryCount = await executeStatement(
      `SELECT COUNT(*) as count FROM localization_registry WHERE is_active = TRUE`,
      []
    );

    // Get entries by app
    const byApp = await executeStatement(
      `SELECT app_id, COUNT(*) as count FROM localization_registry WHERE is_active = TRUE GROUP BY app_id ORDER BY app_id`,
      []
    );

    // Get entries by category
    const byCategory = await executeStatement(
      `SELECT category, COUNT(*) as count FROM localization_registry WHERE is_active = TRUE GROUP BY category ORDER BY count DESC`,
      []
    );

    // Get translation coverage by language
    const coverage = await executeStatement(
      `SELECT 
        lt.language_code,
        COUNT(lt.id) as translated_count,
        (SELECT COUNT(*) FROM localization_registry WHERE is_active = TRUE) as total_count,
        ROUND(COUNT(lt.id)::numeric / NULLIF((SELECT COUNT(*) FROM localization_registry WHERE is_active = TRUE), 0) * 100, 1) as coverage_percent
       FROM localization_translations lt
       JOIN localization_registry lr ON lr.id = lt.registry_id AND lr.is_active = TRUE
       GROUP BY lt.language_code
       ORDER BY coverage_percent DESC`,
      []
    );

    // Get tenant override count
    const overrideCount = await executeStatement(
      `SELECT COUNT(*) as count FROM tenant_translation_overrides WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    // Get protected override count
    const protectedCount = await executeStatement(
      `SELECT COUNT(*) as count FROM tenant_translation_overrides WHERE tenant_id = $1 AND is_protected = TRUE`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return response(200, {
      success: true,
      data: {
        totalEntries: parseInt((registryCount.rows?.[0] as any)?.count || '0'),
        byApp: byApp.rows || [],
        byCategory: byCategory.rows || [],
        languageCoverage: coverage.rows || [],
        tenantOverrides: parseInt((overrideCount.rows?.[0] as any)?.count || '0'),
        protectedOverrides: parseInt((protectedCount.rows?.[0] as any)?.count || '0'),
      },
    });
  } catch (error) {
    logger.error('Error getting stats', { error });
    return response(500, { success: false, error: 'Failed to get localization stats' });
  }
};

// ============================================================================
// Export handler map for router integration
// ============================================================================

export const handlers = {
  listRegistry,
  getRegistryEntry,
  listOverrides,
  upsertOverride,
  deleteOverride,
  toggleProtection,
  getBundle,
  getConfig,
  updateConfig,
  getStats,
};
