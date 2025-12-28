/**
 * RADIANT v4.18.0 - Input Sanitization Middleware
 * 
 * Provides input validation and sanitization for all API handlers.
 * Configurable via system_config database table.
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { RadiantError, ErrorCodes } from '../errors/radiant-error';
import { getSystemConfig } from '../services/system-config';

export interface SanitizationConfig {
  hipaaPhiEnabled: boolean;
  sanitizeHtmlInput: boolean;
  sanitizeSqlInput: boolean;
  maxRequestBodySizeMb: number;
  maxStringFieldLength: number;
  maxArrayItems: number;
  trimStringInputs: boolean;
  normalizeUnicode: boolean;
  blockNullBytes: boolean;
}

let configCache: SanitizationConfig | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL_MS = 60000;

/**
 * Get sanitization configuration from database.
 * Sanitization only applies when HIPAA/PHI compliance mode is enabled.
 */
async function getSanitizationConfig(): Promise<SanitizationConfig> {
  const now = Date.now();
  if (configCache && now - configCacheTime < CONFIG_CACHE_TTL_MS) {
    return configCache;
  }

  try {
    const [complianceConfig, requestConfig] = await Promise.all([
      getSystemConfig('security'),
      getSystemConfig('request_handling'),
    ]);
    
    // HIPAA/PHI mode must be enabled for sanitization to apply
    const hipaaPhiEnabled = Boolean(complianceConfig.hipaa_phi_enabled ?? false);
    
    configCache = {
      hipaaPhiEnabled,
      sanitizeHtmlInput: Boolean(requestConfig.sanitize_html_input ?? true),
      sanitizeSqlInput: Boolean(requestConfig.sanitize_sql_input ?? true),
      maxRequestBodySizeMb: Number(requestConfig.max_request_body_size_mb ?? 10),
      maxStringFieldLength: Number(requestConfig.max_string_field_length ?? 10000),
      maxArrayItems: Number(requestConfig.max_array_items ?? 1000),
      trimStringInputs: Boolean(requestConfig.trim_string_inputs ?? true),
      normalizeUnicode: Boolean(requestConfig.normalize_unicode ?? true),
      blockNullBytes: Boolean(requestConfig.block_null_bytes ?? true),
    };
    configCacheTime = now;
    return configCache;
  } catch (error) {
    // Default: sanitization disabled when HIPAA/PHI not explicitly enabled
    logger.warn('Failed to load sanitization config, using defaults', { error: error instanceof Error ? error.message : 'unknown' });
    return {
      hipaaPhiEnabled: false,
      sanitizeHtmlInput: true,
      sanitizeSqlInput: true,
      maxRequestBodySizeMb: 10,
      maxStringFieldLength: 10000,
      maxArrayItems: 1000,
      trimStringInputs: true,
      normalizeUnicode: true,
      blockNullBytes: true,
    };
  }
}

/**
 * Check if sanitization should be applied based on HIPAA/PHI setting.
 * Returns true only when HIPAA/PHI compliance mode is enabled in database.
 */
export async function isSanitizationEnabled(): Promise<boolean> {
  const config = await getSanitizationConfig();
  return config.hipaaPhiEnabled;
}

// HTML escape patterns
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

// SQL injection patterns to detect
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|DECLARE)\b)/i,
  /('|\"|;|--|\*|\/\*|\*\/)/,
  /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
  /(xp_|sp_)/i,
];

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Check for potential SQL injection patterns
 */
export function detectSqlInjection(str: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(str));
}

/**
 * Normalize unicode to NFC form
 */
export function normalizeUnicode(str: string): string {
  return str.normalize('NFC');
}

/**
 * Remove null bytes from string
 */
export function removeNullBytes(str: string): string {
  return str.replace(/\0/g, '');
}

/**
 * Sanitize a single string value.
 * Only applies sanitization when HIPAA/PHI compliance mode is enabled.
 */
export async function sanitizeString(
  value: string,
  fieldName: string,
  config?: SanitizationConfig
): Promise<string> {
  const cfg = config || (await getSanitizationConfig());
  
  // Skip sanitization if HIPAA/PHI mode is not enabled
  if (!cfg.hipaaPhiEnabled) {
    return value;
  }
  
  let sanitized = value;

  // Check for null bytes
  if (cfg.blockNullBytes && sanitized.includes('\0')) {
    logger.warn('Null bytes detected in input', { field: fieldName });
    sanitized = removeNullBytes(sanitized);
  }

  // Normalize unicode
  if (cfg.normalizeUnicode) {
    sanitized = normalizeUnicode(sanitized);
  }

  // Trim whitespace
  if (cfg.trimStringInputs) {
    sanitized = sanitized.trim();
  }

  // Check length
  if (sanitized.length > cfg.maxStringFieldLength) {
    throw new RadiantError({
      code: ErrorCodes.VALIDATION_INVALID_FORMAT,
      message: `Field '${fieldName}' exceeds maximum length of ${cfg.maxStringFieldLength}`,
      field: fieldName,
      details: { maxLength: cfg.maxStringFieldLength, actualLength: sanitized.length },
    });
  }

  // HTML sanitization
  if (cfg.sanitizeHtmlInput) {
    sanitized = escapeHtml(sanitized);
  }

  // SQL injection detection
  if (cfg.sanitizeSqlInput && detectSqlInjection(value)) {
    logger.warn('Potential SQL injection detected', { field: fieldName });
    throw new RadiantError({
      code: ErrorCodes.VALIDATION_INVALID_FORMAT,
      message: `Invalid characters detected in field '${fieldName}'`,
      field: fieldName,
    });
  }

  return sanitized;
}

/**
 * Recursively sanitize an object.
 * Only applies sanitization when HIPAA/PHI compliance mode is enabled.
 */
export async function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  config?: SanitizationConfig,
  path = ''
): Promise<T> {
  const cfg = config || (await getSanitizationConfig());
  
  // Skip sanitization if HIPAA/PHI mode is not enabled
  if (!cfg.hipaaPhiEnabled) {
    return obj;
  }
  
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = path ? `${path}.${key}` : key;

    if (typeof value === 'string') {
      result[key] = await sanitizeString(value, fieldPath, cfg);
    } else if (Array.isArray(value)) {
      if (value.length > cfg.maxArrayItems) {
        throw new RadiantError({
          code: ErrorCodes.VALIDATION_INVALID_FORMAT,
          message: `Array '${fieldPath}' exceeds maximum items of ${cfg.maxArrayItems}`,
          field: fieldPath,
          details: { maxItems: cfg.maxArrayItems, actualItems: value.length },
        });
      }
      result[key] = await Promise.all(
        value.map(async (item, index) => {
          if (typeof item === 'string') {
            return sanitizeString(item, `${fieldPath}[${index}]`, cfg);
          } else if (typeof item === 'object' && item !== null) {
            return sanitizeObject(item as Record<string, unknown>, cfg, `${fieldPath}[${index}]`);
          }
          return item;
        })
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = await sanitizeObject(value as Record<string, unknown>, cfg, fieldPath);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Middleware to sanitize request body.
 * Only applies sanitization when HIPAA/PHI compliance mode is enabled.
 */
export async function sanitizeRequestBody<T extends Record<string, unknown>>(
  event: APIGatewayProxyEvent
): Promise<T | null> {
  if (!event.body) {
    return null;
  }

  const config = await getSanitizationConfig();
  
  // If HIPAA/PHI mode is not enabled, just parse and return without sanitization
  if (!config.hipaaPhiEnabled) {
    try {
      return JSON.parse(event.body) as T;
    } catch (parseError) {
      console.debug('JSON parse error:', parseError instanceof Error ? parseError.message : 'unknown');
      throw new RadiantError({
        code: ErrorCodes.VALIDATION_INVALID_FORMAT,
        message: 'Invalid JSON in request body',
      });
    }
  }

  // Check body size
  const bodySizeBytes = Buffer.byteLength(event.body, 'utf-8');
  const maxSizeBytes = config.maxRequestBodySizeMb * 1024 * 1024;

  if (bodySizeBytes > maxSizeBytes) {
    throw new RadiantError({
      code: ErrorCodes.VALIDATION_INVALID_FORMAT,
      message: `Request body exceeds maximum size of ${config.maxRequestBodySizeMb}MB`,
      details: { maxSizeMb: config.maxRequestBodySizeMb, actualSizeBytes: bodySizeBytes },
    });
  }

  try {
    const parsed = JSON.parse(event.body) as Record<string, unknown>;
    return await sanitizeObject(parsed, config) as T;
  } catch (error) {
    if (error instanceof RadiantError) {
      throw error;
    }
    throw new RadiantError({
      code: ErrorCodes.VALIDATION_INVALID_FORMAT,
      message: 'Invalid JSON in request body',
    });
  }
}

/**
 * Sanitize query string parameters.
 * Only applies sanitization when HIPAA/PHI compliance mode is enabled.
 */
export async function sanitizeQueryParams(
  event: APIGatewayProxyEvent
): Promise<Record<string, string>> {
  const params = event.queryStringParameters || {};
  const config = await getSanitizationConfig();
  
  // Skip sanitization if HIPAA/PHI mode is not enabled
  if (!config.hipaaPhiEnabled) {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        result[key] = String(value);
      }
    }
    return result;
  }
  
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      result[key] = await sanitizeString(String(value), `query.${key}`, config);
    }
  }

  return result;
}

/**
 * Sanitize path parameters.
 * Only applies sanitization when HIPAA/PHI compliance mode is enabled.
 */
export async function sanitizePathParams(
  event: APIGatewayProxyEvent
): Promise<Record<string, string>> {
  const params = event.pathParameters || {};
  const config = await getSanitizationConfig();
  
  // Skip sanitization if HIPAA/PHI mode is not enabled
  if (!config.hipaaPhiEnabled) {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        result[key] = String(value);
      }
    }
    return result;
  }
  
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      result[key] = await sanitizeString(String(value), `path.${key}`, config);
    }
  }

  return result;
}

/**
 * Full request sanitization
 */
export interface SanitizedRequest<T = Record<string, unknown>> {
  body: T | null;
  queryParams: Record<string, string>;
  pathParams: Record<string, string>;
}

export async function sanitizeRequest<T extends Record<string, unknown>>(
  event: APIGatewayProxyEvent
): Promise<SanitizedRequest<T>> {
  const [body, queryParams, pathParams] = await Promise.all([
    sanitizeRequestBody<T>(event),
    sanitizeQueryParams(event),
    sanitizePathParams(event),
  ]);

  return { body, queryParams, pathParams };
}
