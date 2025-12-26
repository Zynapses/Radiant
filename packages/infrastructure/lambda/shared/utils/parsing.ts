/**
 * Safe parsing utilities
 * Provides type-safe parsing for JSON, numbers, and other common data types
 */

import { logger } from '../logger';

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T = unknown>(
  json: string | null | undefined,
  defaultValue?: T
): { success: true; data: T } | { success: false; error: string; data: T | undefined } {
  if (!json) {
    return defaultValue !== undefined
      ? { success: false, error: 'Empty input', data: defaultValue }
      : { success: false, error: 'Empty input', data: undefined };
  }

  try {
    const parsed = JSON.parse(json) as T;
    return { success: true, data: parsed };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown parse error';
    return {
      success: false,
      error: errorMessage,
      data: defaultValue,
    };
  }
}

/**
 * Parse JSON or return default value (throws on error if no default)
 */
export function parseJsonOrDefault<T>(json: string | null | undefined, defaultValue: T): T {
  const result = safeJsonParse<T>(json, defaultValue);
  return result.data as T;
}

/**
 * Parse JSON and throw descriptive error on failure
 */
export function parseJsonOrThrow<T>(json: string | null | undefined, context?: string): T {
  if (!json) {
    throw new Error(`${context ? context + ': ' : ''}Expected JSON but received empty input`);
  }

  try {
    return JSON.parse(json) as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`${context ? context + ': ' : ''}Invalid JSON - ${errorMessage}`);
  }
}

/**
 * Safely parse an integer with validation
 */
export function safeParseInt(
  value: string | number | null | undefined,
  options: {
    default?: number;
    min?: number;
    max?: number;
    radix?: number;
  } = {}
): number {
  const { default: defaultValue = 0, min, max, radix = 10 } = options;

  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = typeof value === 'number' ? Math.floor(value) : parseInt(String(value), radix);

  if (Number.isNaN(parsed)) {
    return defaultValue;
  }

  let result = parsed;
  if (min !== undefined && result < min) result = min;
  if (max !== undefined && result > max) result = max;

  return result;
}

/**
 * Safely parse a float with validation
 */
export function safeParseFloat(
  value: string | number | null | undefined,
  options: {
    default?: number;
    min?: number;
    max?: number;
    precision?: number;
  } = {}
): number {
  const { default: defaultValue = 0, min, max, precision } = options;

  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = typeof value === 'number' ? value : parseFloat(String(value));

  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return defaultValue;
  }

  let result = parsed;
  if (min !== undefined && result < min) result = min;
  if (max !== undefined && result > max) result = max;
  if (precision !== undefined) result = Number(result.toFixed(precision));

  return result;
}

/**
 * Parse pagination parameters from query string
 */
export function parsePagination(
  query: Record<string, string | undefined> | null,
  options: { maxLimit?: number; defaultLimit?: number } = {}
): { page: number; limit: number; offset: number } {
  const { maxLimit = 100, defaultLimit = 20 } = options;

  const page = safeParseInt(query?.page, { default: 1, min: 1 });
  const limit = safeParseInt(query?.limit, { default: defaultLimit, min: 1, max: maxLimit });
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Parse boolean from string
 */
export function parseBoolean(
  value: string | boolean | null | undefined,
  defaultValue = false
): boolean {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const lower = String(value).toLowerCase().trim();
  if (['true', '1', 'yes', 'on'].includes(lower)) return true;
  if (['false', '0', 'no', 'off'].includes(lower)) return false;

  return defaultValue;
}

/**
 * Parse date from string with validation
 */
export function safeParseDate(
  value: string | Date | null | undefined,
  defaultValue?: Date
): Date | undefined {
  if (!value) return defaultValue;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? defaultValue : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? defaultValue : parsed;
}

/**
 * Parse and validate enum value
 */
export function parseEnum<T extends string>(
  value: string | null | undefined,
  validValues: readonly T[],
  defaultValue: T
): T {
  if (!value) return defaultValue;
  return validValues.includes(value as T) ? (value as T) : defaultValue;
}

/**
 * Parse comma-separated string to array
 */
export function parseStringArray(
  value: string | null | undefined,
  options: { separator?: string; trim?: boolean; filter?: boolean } = {}
): string[] {
  const { separator = ',', trim = true, filter = true } = options;

  if (!value) return [];

  let items = value.split(separator);
  if (trim) items = items.map(s => s.trim());
  if (filter) items = items.filter(s => s.length > 0);

  return items;
}

/**
 * Validate request body size
 */
export function validateBodySize(
  body: string | null | undefined,
  maxSizeBytes: number = 1024 * 1024 // 1MB default
): { valid: true } | { valid: false; error: string } {
  if (!body) {
    return { valid: true };
  }

  const size = Buffer.byteLength(body, 'utf8');
  if (size > maxSizeBytes) {
    return {
      valid: false,
      error: `Request body too large: ${size} bytes (max: ${maxSizeBytes} bytes)`,
    };
  }

  return { valid: true };
}
