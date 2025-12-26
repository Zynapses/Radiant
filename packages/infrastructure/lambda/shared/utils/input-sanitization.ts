/**
 * RADIANT v4.18.0 - Input Sanitization Utilities
 * 
 * Provides comprehensive input validation and sanitization
 * to prevent XSS, SQL injection, and other security issues.
 */

import { z } from 'zod';

// Configuration from environment (will be overridden by DB config)
const CONFIG = {
  maxStringLength: parseInt(process.env.MAX_STRING_FIELD_LENGTH || '10000', 10),
  maxArrayItems: parseInt(process.env.MAX_ARRAY_ITEMS || '1000', 10),
  trimStrings: process.env.TRIM_STRING_INPUTS !== 'false',
  normalizeUnicode: process.env.NORMALIZE_UNICODE !== 'false',
  blockNullBytes: process.env.BLOCK_NULL_BYTES !== 'false',
  sanitizeHtml: process.env.SANITIZE_HTML_INPUT !== 'false',
  sanitizeSql: process.env.SANITIZE_SQL_INPUT !== 'false',
};

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
  /(-{2}|\/\*|\*\/)/,
  /(;|\||&)/,
  /(\bOR\b\s+\d+\s*=\s*\d+)/i,
  /(\bAND\b\s+\d+\s*=\s*\d+)/i,
  /('|")\s*(OR|AND)\s*('|")/i,
];

// XSS patterns
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /<link/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
];

// HTML entities for encoding
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

export interface SanitizationResult<T> {
  value: T;
  sanitized: boolean;
  warnings: string[];
}

export interface SanitizationOptions {
  maxLength?: number;
  trimWhitespace?: boolean;
  normalizeUnicode?: boolean;
  blockNullBytes?: boolean;
  sanitizeHtml?: boolean;
  checkSqlInjection?: boolean;
  allowedHtmlTags?: string[];
  customPatterns?: RegExp[];
}

/**
 * Sanitize a string value
 */
export function sanitizeString(
  input: string,
  options: SanitizationOptions = {}
): SanitizationResult<string> {
  const opts = {
    maxLength: options.maxLength ?? CONFIG.maxStringLength,
    trimWhitespace: options.trimWhitespace ?? CONFIG.trimStrings,
    normalizeUnicode: options.normalizeUnicode ?? CONFIG.normalizeUnicode,
    blockNullBytes: options.blockNullBytes ?? CONFIG.blockNullBytes,
    sanitizeHtml: options.sanitizeHtml ?? CONFIG.sanitizeHtml,
    checkSqlInjection: options.checkSqlInjection ?? CONFIG.sanitizeSql,
  };

  const warnings: string[] = [];
  let value = input;
  let sanitized = false;

  // Block null bytes
  if (opts.blockNullBytes && value.includes('\0')) {
    value = value.replace(/\0/g, '');
    warnings.push('Null bytes removed');
    sanitized = true;
  }

  // Trim whitespace
  if (opts.trimWhitespace) {
    const trimmed = value.trim();
    if (trimmed !== value) {
      value = trimmed;
      sanitized = true;
    }
  }

  // Normalize unicode
  if (opts.normalizeUnicode) {
    const normalized = value.normalize('NFC');
    if (normalized !== value) {
      value = normalized;
      sanitized = true;
    }
  }

  // Truncate if too long
  if (value.length > opts.maxLength) {
    value = value.substring(0, opts.maxLength);
    warnings.push(`String truncated to ${opts.maxLength} characters`);
    sanitized = true;
  }

  // HTML sanitization
  if (opts.sanitizeHtml) {
    const htmlSanitized = escapeHtml(value);
    if (htmlSanitized !== value) {
      value = htmlSanitized;
      warnings.push('HTML entities escaped');
      sanitized = true;
    }
  }

  // SQL injection check (warning only, doesn't modify)
  if (opts.checkSqlInjection) {
    const hasSqlPatterns = SQL_INJECTION_PATTERNS.some(pattern => pattern.test(value));
    if (hasSqlPatterns) {
      warnings.push('Potential SQL injection pattern detected');
    }
  }

  return { value, sanitized, warnings };
}

/**
 * Escape HTML entities
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=\/]/g, char => HTML_ENTITIES[char] || char);
}

/**
 * Strip all HTML tags
 */
export function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Check for XSS patterns
 */
export function hasXssPatterns(str: string): boolean {
  return XSS_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * Check for SQL injection patterns
 */
export function hasSqlInjectionPatterns(str: string): boolean {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  input: T,
  options: SanitizationOptions = {}
): SanitizationResult<T> {
  const warnings: string[] = [];
  let sanitized = false;

  const sanitizeValue = (value: unknown, path: string): unknown => {
    if (typeof value === 'string') {
      const result = sanitizeString(value, options);
      if (result.sanitized) {
        sanitized = true;
        warnings.push(...result.warnings.map(w => `${path}: ${w}`));
      }
      return result.value;
    }

    if (Array.isArray(value)) {
      const maxItems = options.maxLength ?? CONFIG.maxArrayItems;
      let arrayValue = value as unknown[];
      if (arrayValue.length > maxItems) {
        warnings.push(`${path}: Array truncated to ${maxItems} items`);
        sanitized = true;
        arrayValue = arrayValue.slice(0, maxItems);
      }
      return arrayValue.map((item: unknown, index: number) => sanitizeValue(item, `${path}[${index}]`));
    }

    if (value !== null && typeof value === 'object') {
      const sanitizedObj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitizedObj[key] = sanitizeValue(val, `${path}.${key}`);
      }
      return sanitizedObj;
    }

    return value;
  };

  const result = sanitizeValue(input, '') as T;
  return { value: result, sanitized, warnings };
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): SanitizationResult<string> {
  const warnings: string[] = [];
  let value = email.trim().toLowerCase();
  let sanitized = value !== email;

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    warnings.push('Invalid email format');
  }

  return { value, sanitized, warnings };
}

/**
 * Validate and sanitize UUID
 */
export function sanitizeUuid(uuid: string): SanitizationResult<string> {
  const warnings: string[] = [];
  const value = uuid.trim().toLowerCase();
  const sanitized = value !== uuid;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    warnings.push('Invalid UUID format');
  }

  return { value, sanitized, warnings };
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string): SanitizationResult<string> {
  const warnings: string[] = [];
  let value = url.trim();
  let sanitized = value !== url;

  // Check for javascript: or data: URLs
  if (/^(javascript|data|vbscript):/i.test(value)) {
    warnings.push('Potentially dangerous URL scheme detected');
    value = '';
    sanitized = true;
  }

  return { value, sanitized, warnings };
}

/**
 * Create a Zod schema with sanitization
 */
export function sanitizedString(options: SanitizationOptions = {}) {
  return z.string().transform(val => sanitizeString(val, options).value);
}

/**
 * Create a Zod schema for sanitized email
 */
export function sanitizedEmail() {
  return z.string().email().transform(val => sanitizeEmail(val).value);
}

/**
 * Create a Zod schema for sanitized UUID
 */
export function sanitizedUuid() {
  return z.string().uuid().transform(val => sanitizeUuid(val).value);
}

/**
 * Middleware for sanitizing request body
 */
export function sanitizeRequestBody<T extends Record<string, unknown>>(
  body: T,
  options: SanitizationOptions = {}
): { body: T; warnings: string[] } {
  const result = sanitizeObject(body, options);
  return { body: result.value, warnings: result.warnings };
}

/**
 * Validate request against common attack patterns
 */
export function validateSecurityPatterns(input: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (hasXssPatterns(input)) {
    issues.push('Potential XSS pattern detected');
  }

  if (hasSqlInjectionPatterns(input)) {
    issues.push('Potential SQL injection pattern detected');
  }

  if (input.includes('\0')) {
    issues.push('Null byte detected');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Escape for SQL LIKE queries (to prevent wildcard injection)
 */
export function escapeSqlLike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

/**
 * Create a safe filename from user input
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^\.+/, '')
    .substring(0, 255);
}

export { CONFIG as SANITIZATION_CONFIG };
